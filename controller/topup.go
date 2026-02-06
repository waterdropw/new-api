package controller

import (
	"context"
	"fmt"
	"log"
	"net/url"
	"strconv"
	"sync"
	"time"

	"github.com/QuantumNous/new-api/common"
	"github.com/QuantumNous/new-api/logger"
	"github.com/QuantumNous/new-api/model"
	"github.com/QuantumNous/new-api/service"
	"github.com/QuantumNous/new-api/setting"
	"github.com/QuantumNous/new-api/setting/operation_setting"
	"github.com/QuantumNous/new-api/setting/system_setting"

	"github.com/Calcium-Ion/go-epay/epay"
	"github.com/gin-gonic/gin"
	"github.com/samber/lo"
	"github.com/shopspring/decimal"
)

func GetTopUpInfo(c *gin.Context) {
	// 获取支付方式
	payMethods := operation_setting.PayMethods

	// 如果启用了 Stripe 支付，添加到支付方法列表
	if setting.StripeApiSecret != "" && setting.StripeWebhookSecret != "" && setting.StripePriceId != "" {
		// 检查是否已经包含 Stripe
		hasStripe := false
		for _, method := range payMethods {
			if method["type"] == "stripe" {
				hasStripe = true
				break
			}
		}

		if !hasStripe {
			stripeMethod := map[string]string{
				"name":      "Stripe",
				"type":      "stripe",
				"color":     "rgba(var(--semi-purple-5), 1)",
				"min_topup": strconv.Itoa(setting.StripeMinTopUp),
			}
			payMethods = append(payMethods, stripeMethod)
		}
	}

	// 检查是否启用了任何在线充值方式（Epay、支付宝直连、微信直连）
	epayEnabled := operation_setting.PayAddress != "" && operation_setting.EpayId != "" && operation_setting.EpayKey != ""
	alipayDirectEnabled := operation_setting.AlipayEnabled
	wxpayDirectEnabled := operation_setting.WxpayEnabled
	enableOnlineTopup := epayEnabled || alipayDirectEnabled || wxpayDirectEnabled

	data := gin.H{
		"enable_online_topup":  enableOnlineTopup,
		"enable_stripe_topup":  setting.StripeApiSecret != "" && setting.StripeWebhookSecret != "" && setting.StripePriceId != "",
		"enable_creem_topup":   setting.CreemApiKey != "" && setting.CreemProducts != "[]",
		"enable_alipay_direct": alipayDirectEnabled,
		"enable_wxpay_direct":  wxpayDirectEnabled,
		"creem_products":       setting.CreemProducts,
		"pay_methods":          payMethods,
		"min_topup":            operation_setting.MinTopUp,
		"stripe_min_topup":     setting.StripeMinTopUp,
		"amount_options":       operation_setting.GetPaymentSetting().AmountOptions,
		"discount":             operation_setting.GetPaymentSetting().AmountDiscount,
	}
	common.ApiSuccess(c, data)
}

type EpayRequest struct {
	Amount        int64  `json:"amount"`
	PaymentMethod string `json:"payment_method"`
	TopUpCode     string `json:"top_up_code"`
}

type AmountRequest struct {
	Amount    int64  `json:"amount"`
	TopUpCode string `json:"top_up_code"`
}

func GetEpayClient() *epay.Client {
	if operation_setting.PayAddress == "" || operation_setting.EpayId == "" || operation_setting.EpayKey == "" {
		return nil
	}
	withUrl, err := epay.NewClient(&epay.Config{
		PartnerID: operation_setting.EpayId,
		Key:       operation_setting.EpayKey,
	}, operation_setting.PayAddress)
	if err != nil {
		return nil
	}
	return withUrl
}

func getPayMoney(amount int64, group string) float64 {
	dAmount := decimal.NewFromInt(amount)
	
	// 现在 amount 就是人民币金额，直接应用折扣即可
	// 实付金额 = 充值金额 × 折扣
	discount := 1.0
	if ds, ok := operation_setting.GetPaymentSetting().AmountDiscount[int(amount)]; ok {
		if ds > 0 {
			discount = ds
		}
	}
	dDiscount := decimal.NewFromFloat(discount)

	payMoney := dAmount.Mul(dDiscount)

	return payMoney.InexactFloat64()
}

func getMinTopup() int64 {
	minTopup := operation_setting.MinTopUp
	if operation_setting.GetQuotaDisplayType() == operation_setting.QuotaDisplayTypeTokens {
		dMinTopup := decimal.NewFromInt(int64(minTopup))
		dQuotaPerUnit := decimal.NewFromFloat(common.QuotaPerUnit)
		minTopup = int(dMinTopup.Mul(dQuotaPerUnit).IntPart())
	}
	return int64(minTopup)
}

func RequestEpay(c *gin.Context) {
	var req EpayRequest
	err := c.ShouldBindJSON(&req)
	if err != nil {
		c.JSON(200, gin.H{"message": "error", "data": "参数错误"})
		return
	}
	if req.Amount < getMinTopup() {
		c.JSON(200, gin.H{"message": "error", "data": fmt.Sprintf("充值数量不能小于 %d", getMinTopup())})
		return
	}

	id := c.GetInt("id")
	group, err := model.GetUserGroup(id, true)
	if err != nil {
		c.JSON(200, gin.H{"message": "error", "data": "获取用户分组失败"})
		return
	}
	payMoney := getPayMoney(req.Amount, group)
	if payMoney < 0.01 {
		c.JSON(200, gin.H{"message": "error", "data": "充值金额过低"})
		return
	}

	if !operation_setting.ContainsPayMethod(req.PaymentMethod) {
		c.JSON(200, gin.H{"message": "error", "data": "支付方式不存在"})
		return
	}

	callBackAddress := service.GetCallbackAddress()
	returnUrl, _ := url.Parse(system_setting.ServerAddress + "/console/log")
	notifyUrl, _ := url.Parse(callBackAddress + "/api/user/epay/notify")
	tradeNo := fmt.Sprintf("%s%d", common.GetRandomString(6), time.Now().Unix())
	tradeNo = fmt.Sprintf("USR%dNO%s", id, tradeNo)
	client := GetEpayClient()
	if client == nil {
		c.JSON(200, gin.H{"message": "error", "data": "当前管理员未配置支付信息"})
		return
	}
	uri, params, err := client.Purchase(&epay.PurchaseArgs{
		Type:           req.PaymentMethod,
		ServiceTradeNo: tradeNo,
		Name:           fmt.Sprintf("TUC%d", req.Amount),
		Money:          strconv.FormatFloat(payMoney, 'f', 2, 64),
		Device:         epay.PC,
		NotifyUrl:      notifyUrl,
		ReturnUrl:      returnUrl,
	})
	if err != nil {
		c.JSON(200, gin.H{"message": "error", "data": "拉起支付失败"})
		return
	}
	amount := req.Amount
	if operation_setting.GetQuotaDisplayType() == operation_setting.QuotaDisplayTypeTokens {
		dAmount := decimal.NewFromInt(int64(amount))
		dQuotaPerUnit := decimal.NewFromFloat(common.QuotaPerUnit)
		amount = dAmount.Div(dQuotaPerUnit).IntPart()
	}
	topUp := &model.TopUp{
		UserId:        id,
		Amount:        amount,
		Money:         payMoney,
		TradeNo:       tradeNo,
		PaymentMethod: req.PaymentMethod,
		CreateTime:    time.Now().Unix(),
		Status:        "pending",
	}
	err = topUp.Insert()
	if err != nil {
		c.JSON(200, gin.H{"message": "error", "data": "创建订单失败"})
		return
	}
	c.JSON(200, gin.H{"message": "success", "data": params, "url": uri})
}

// tradeNo lock
var orderLocks sync.Map
var createLock sync.Mutex

// LockOrder 尝试对给定订单号加锁
func LockOrder(tradeNo string) {
	lock, ok := orderLocks.Load(tradeNo)
	if !ok {
		createLock.Lock()
		defer createLock.Unlock()
		lock, ok = orderLocks.Load(tradeNo)
		if !ok {
			lock = new(sync.Mutex)
			orderLocks.Store(tradeNo, lock)
		}
	}
	lock.(*sync.Mutex).Lock()
}

// UnlockOrder 释放给定订单号的锁
func UnlockOrder(tradeNo string) {
	lock, ok := orderLocks.Load(tradeNo)
	if ok {
		lock.(*sync.Mutex).Unlock()
	}
}

func EpayNotify(c *gin.Context) {
	params := lo.Reduce(lo.Keys(c.Request.URL.Query()), func(r map[string]string, t string, i int) map[string]string {
		r[t] = c.Request.URL.Query().Get(t)
		return r
	}, map[string]string{})
	client := GetEpayClient()
	if client == nil {
		log.Println("易支付回调失败 未找到配置信息")
		_, err := c.Writer.Write([]byte("fail"))
		if err != nil {
			log.Println("易支付回调写入失败")
		}
		return
	}
	verifyInfo, err := client.Verify(params)
	if err == nil && verifyInfo.VerifyStatus {
		_, err := c.Writer.Write([]byte("success"))
		if err != nil {
			log.Println("易支付回调写入失败")
		}
	} else {
		_, err := c.Writer.Write([]byte("fail"))
		if err != nil {
			log.Println("易支付回调写入失败")
		}
		log.Println("易支付回调签名验证失败")
		return
	}

	if verifyInfo.TradeStatus == epay.StatusTradeSuccess {
		log.Println(verifyInfo)
		LockOrder(verifyInfo.ServiceTradeNo)
		defer UnlockOrder(verifyInfo.ServiceTradeNo)
		topUp := model.GetTopUpByTradeNo(verifyInfo.ServiceTradeNo)
		if topUp == nil {
			log.Printf("易支付回调未找到订单: %v", verifyInfo)
			return
		}
		if topUp.Status == "pending" {
			topUp.Status = "success"
			err := topUp.Update()
			if err != nil {
				log.Printf("易支付回调更新订单失败: %v", topUp)
				return
			}
			//user, _ := model.GetUserById(topUp.UserId, false)
			//user.Quota += topUp.Amount * 500000
			dAmount := decimal.NewFromInt(int64(topUp.Amount))
			dQuotaPerUnit := decimal.NewFromFloat(common.QuotaPerUnit)
			quotaToAdd := int(dAmount.Mul(dQuotaPerUnit).IntPart())
			err = model.IncreaseUserQuota(topUp.UserId, quotaToAdd, true)
			if err != nil {
				log.Printf("易支付回调更新用户失败: %v", topUp)
				return
			}
			log.Printf("易支付回调更新用户成功 %v", topUp)
			model.RecordLog(topUp.UserId, model.LogTypeTopup, fmt.Sprintf("使用在线充值成功，充值金额: %v，支付金额：%f", logger.LogQuota(quotaToAdd), topUp.Money))
		}
	} else {
		log.Printf("易支付异常回调: %v", verifyInfo)
	}
}

func RequestAmount(c *gin.Context) {
	var req AmountRequest
	err := c.ShouldBindJSON(&req)
	if err != nil {
		c.JSON(200, gin.H{"message": "error", "data": "参数错误"})
		return
	}

	if req.Amount < getMinTopup() {
		c.JSON(200, gin.H{"message": "error", "data": fmt.Sprintf("充值数量不能小于 %d", getMinTopup())})
		return
	}
	id := c.GetInt("id")
	group, err := model.GetUserGroup(id, true)
	if err != nil {
		c.JSON(200, gin.H{"message": "error", "data": "获取用户分组失败"})
		return
	}
	payMoney := getPayMoney(req.Amount, group)
	if payMoney <= 0.01 {
		c.JSON(200, gin.H{"message": "error", "data": "充值金额过低"})
		return
	}
	c.JSON(200, gin.H{"message": "success", "data": strconv.FormatFloat(payMoney, 'f', 2, 64)})
}

func GetUserTopUps(c *gin.Context) {
	userId := c.GetInt("id")
	pageInfo := common.GetPageQuery(c)
	keyword := c.Query("keyword")

	var (
		topups []*model.TopUp
		total  int64
		err    error
	)
	if keyword != "" {
		topups, total, err = model.SearchUserTopUps(userId, keyword, pageInfo)
	} else {
		topups, total, err = model.GetUserTopUps(userId, pageInfo)
	}
	if err != nil {
		common.ApiError(c, err)
		return
	}

	pageInfo.SetTotal(int(total))
	pageInfo.SetItems(topups)
	common.ApiSuccess(c, pageInfo)
}

// GetAllTopUps 管理员获取全平台充值记录
func GetAllTopUps(c *gin.Context) {
	pageInfo := common.GetPageQuery(c)
	keyword := c.Query("keyword")

	var (
		topups []*model.TopUp
		total  int64
		err    error
	)
	if keyword != "" {
		topups, total, err = model.SearchAllTopUps(keyword, pageInfo)
	} else {
		topups, total, err = model.GetAllTopUps(pageInfo)
	}
	if err != nil {
		common.ApiError(c, err)
		return
	}

	pageInfo.SetTotal(int(total))
	pageInfo.SetItems(topups)
	common.ApiSuccess(c, pageInfo)
}

type AdminCompleteTopupRequest struct {
	TradeNo string `json:"trade_no"`
}

// AdminCompleteTopUp 管理员补单接口
func AdminCompleteTopUp(c *gin.Context) {
	var req AdminCompleteTopupRequest
	if err := c.ShouldBindJSON(&req); err != nil || req.TradeNo == "" {
		common.ApiErrorMsg(c, "参数错误")
		return
	}

	// 订单级互斥，防止并发补单
	LockOrder(req.TradeNo)
	defer UnlockOrder(req.TradeNo)

	if err := model.ManualCompleteTopUp(req.TradeNo); err != nil {
		common.ApiError(c, err)
		return
	}
	common.ApiSuccess(c, nil)
}

// RequestAlipayDirect 支付宝直连支付
func RequestAlipayDirect(c *gin.Context) {
	var req EpayRequest
	err := c.ShouldBindJSON(&req)
	if err != nil {
		c.JSON(200, gin.H{"message": "error", "data": "参数错误"})
		return
	}
	if req.Amount < getMinTopup() {
		c.JSON(200, gin.H{"message": "error", "data": fmt.Sprintf("充值数量不能小于 %d", getMinTopup())})
		return
	}

	id := c.GetInt("id")
	group, err := model.GetUserGroup(id, true)
	if err != nil {
		c.JSON(200, gin.H{"message": "error", "data": "获取用户分组失败"})
		return
	}
	payMoney := getPayMoney(req.Amount, group)
	if payMoney < 0.01 {
		c.JSON(200, gin.H{"message": "error", "data": "充值金额过低"})
		return
	}

	// 生成订单号
	tradeNo := fmt.Sprintf("%s%d", common.GetRandomString(6), time.Now().Unix())
	tradeNo = fmt.Sprintf("USR%dNO%s", id, tradeNo)

	// 回调地址
	callBackAddress := service.GetCallbackAddress()
	notifyUrl := callBackAddress + "/api/user/alipay/notify"

	// 调用支付宝生成二维码
	qrCode, err := service.CreateAlipayQRCode(
		tradeNo,
		payMoney,
		fmt.Sprintf("充值%.0f元", float64(req.Amount)),
		notifyUrl,
	)
	if err != nil {
		log.Printf("支付宝生成二维码失败: %v", err)
		c.JSON(200, gin.H{"message": "error", "data": "生成支付二维码失败: " + err.Error()})
		return
	}

	// 保存订单
	amount := req.Amount
	if operation_setting.GetQuotaDisplayType() == operation_setting.QuotaDisplayTypeTokens {
		dAmount := decimal.NewFromInt(int64(amount))
		dQuotaPerUnit := decimal.NewFromFloat(common.QuotaPerUnit)
		amount = dAmount.Div(dQuotaPerUnit).IntPart()
	}
	topUp := &model.TopUp{
		UserId:        id,
		Amount:        amount,
		Money:         payMoney,
		TradeNo:       tradeNo,
		PaymentMethod: "alipay_direct",
		CreateTime:    time.Now().Unix(),
		Status:        "pending",
	}
	err = topUp.Insert()
	if err != nil {
		c.JSON(200, gin.H{"message": "error", "data": "创建订单失败"})
		return
	}

	c.JSON(200, gin.H{
		"message":  "success",
		"qr_code":  qrCode,
		"trade_no": tradeNo,
	})
}

// RequestWxpayDirect 微信直连支付
func RequestWxpayDirect(c *gin.Context) {
	var req EpayRequest
	err := c.ShouldBindJSON(&req)
	if err != nil {
		c.JSON(200, gin.H{"message": "error", "data": "参数错误"})
		return
	}
	if req.Amount < getMinTopup() {
		c.JSON(200, gin.H{"message": "error", "data": fmt.Sprintf("充值数量不能小于 %d", getMinTopup())})
		return
	}

	id := c.GetInt("id")
	group, err := model.GetUserGroup(id, true)
	if err != nil {
		c.JSON(200, gin.H{"message": "error", "data": "获取用户分组失败"})
		return
	}
	payMoney := getPayMoney(req.Amount, group)
	if payMoney < 0.01 {
		c.JSON(200, gin.H{"message": "error", "data": "充值金额过低"})
		return
	}

	// 生成订单号
	tradeNo := fmt.Sprintf("%s%d", common.GetRandomString(6), time.Now().Unix())
	tradeNo = fmt.Sprintf("USR%dNO%s", id, tradeNo)

	// 回调地址
	callBackAddress := service.GetCallbackAddress()
	notifyUrl := callBackAddress + "/api/user/wxpay/notify"

	// 微信支付金额单位是分
	wxpayAmount := int64(payMoney * 100)

	// 调用微信支付生成二维码
	qrCode, err := service.CreateWxpayQRCode(
		tradeNo,
		wxpayAmount,
		fmt.Sprintf("充值%.0f元", float64(req.Amount)),
		notifyUrl,
	)
	if err != nil {
		log.Printf("微信支付生成二维码失败: %v", err)
		c.JSON(200, gin.H{"message": "error", "data": "生成支付二维码失败: " + err.Error()})
		return
	}

	// 保存订单
	amount := req.Amount
	if operation_setting.GetQuotaDisplayType() == operation_setting.QuotaDisplayTypeTokens {
		dAmount := decimal.NewFromInt(int64(amount))
		dQuotaPerUnit := decimal.NewFromFloat(common.QuotaPerUnit)
		amount = dAmount.Div(dQuotaPerUnit).IntPart()
	}
	topUp := &model.TopUp{
		UserId:        id,
		Amount:        amount,
		Money:         payMoney,
		TradeNo:       tradeNo,
		PaymentMethod: "wxpay_direct",
		CreateTime:    time.Now().Unix(),
		Status:        "pending",
	}
	err = topUp.Insert()
	if err != nil {
		c.JSON(200, gin.H{"message": "error", "data": "创建订单失败"})
		return
	}

	c.JSON(200, gin.H{
		"message":  "success",
		"qr_code":  qrCode,
		"trade_no": tradeNo,
	})
}

// AlipayNotify 支付宝异步回调
func AlipayNotify(c *gin.Context) {
	// 解析表单参数
	if err := c.Request.ParseForm(); err != nil {
		log.Println("支付宝回调解析参数失败:", err)
		c.String(200, "fail")
		return
	}

	// 转换为map
	params := make(map[string]string)
	for k, v := range c.Request.Form {
		if len(v) > 0 {
			params[k] = v[0]
		}
	}

	// 验证签名
	ok, err := service.VerifyAlipayNotify(params)
	if err != nil || !ok {
		log.Println("支付宝签名验证失败:", err)
		c.String(200, "fail")
		return
	}

	// 获取订单号和交易状态
	tradeNo := params["out_trade_no"]
	tradeStatus := params["trade_status"]

	log.Printf("支付宝回调: 订单号=%s, 状态=%s", tradeNo, tradeStatus)

	// 只有交易成功才处理
	if tradeStatus == "TRADE_SUCCESS" || tradeStatus == "TRADE_FINISHED" {
		LockOrder(tradeNo)
		defer UnlockOrder(tradeNo)

		topUp := model.GetTopUpByTradeNo(tradeNo)
		if topUp == nil {
			log.Printf("支付宝回调未找到订单: %s", tradeNo)
			c.String(200, "success") // 返回success避免支付宝重复通知
			return
		}

		if topUp.Status == "pending" {
			topUp.Status = "success"
			err := topUp.Update()
			if err != nil {
				log.Printf("支付宝回调更新订单失败: %v", topUp)
				c.String(200, "fail")
				return
			}

			// 给用户充值
			dAmount := decimal.NewFromInt(int64(topUp.Amount))
			dQuotaPerUnit := decimal.NewFromFloat(common.QuotaPerUnit)
			quotaToAdd := int(dAmount.Mul(dQuotaPerUnit).IntPart())
			err = model.IncreaseUserQuota(topUp.UserId, quotaToAdd, true)
			if err != nil {
				log.Printf("支付宝回调更新用户失败: %v", topUp)
				c.String(200, "fail")
				return
			}

			log.Printf("支付宝回调更新用户成功 %v", topUp)
			model.RecordLog(topUp.UserId, model.LogTypeTopup, fmt.Sprintf("使用支付宝充值成功，充值金额: %v，支付金额：%.2f", logger.LogQuota(quotaToAdd), topUp.Money))
		}
	}

	c.String(200, "success")
}

// WxpayNotify 微信支付异步回调
func WxpayNotify(c *gin.Context) {
	// 获取微信支付通知处理器
	handler, err := service.GetWxpayNotifyHandler()
	if err != nil {
		log.Println("获取微信支付通知处理器失败:", err)
		c.JSON(500, gin.H{"code": "FAIL", "message": "系统错误"})
		return
	}

	// 解析通知内容
	transaction := new(struct {
		Mchid          *string `json:"mchid"`
		Appid          *string `json:"appid"`
		OutTradeNo     *string `json:"out_trade_no"`
		TransactionId  *string `json:"transaction_id"`
		TradeType      *string `json:"trade_type"`
		TradeState     *string `json:"trade_state"`
		TradeStateDesc *string `json:"trade_state_desc"`
		BankType       *string `json:"bank_type"`
		Attach         *string `json:"attach"`
		SuccessTime    *string `json:"success_time"`
		Payer          *struct {
			Openid *string `json:"openid"`
		} `json:"payer"`
		Amount *struct {
			Total         *int64  `json:"total"`
			PayerTotal    *int64  `json:"payer_total"`
			Currency      *string `json:"currency"`
			PayerCurrency *string `json:"payer_currency"`
		} `json:"amount"`
	})

	notifyReq, err := handler.ParseNotifyRequest(context.Background(), c.Request, transaction)
	if err != nil {
		log.Println("微信支付回调解析失败:", err)
		c.JSON(500, gin.H{"code": "FAIL", "message": "解析失败"})
		return
	}

	// 新版 SDK 已经在 ParseNotifyRequest 中自动解密了，不需要再调用 DecryptCipherText
	_ = notifyReq // 标记为已使用

	if transaction.OutTradeNo == nil || transaction.TradeState == nil {
		log.Println("微信支付回调参数不完整")
		c.JSON(400, gin.H{"code": "FAIL", "message": "参数错误"})
		return
	}

	tradeNo := *transaction.OutTradeNo
	tradeState := *transaction.TradeState

	log.Printf("微信支付回调: 订单号=%s, 状态=%s", tradeNo, tradeState)

	// 只有交易成功才处理
	if tradeState == "SUCCESS" {
		LockOrder(tradeNo)
		defer UnlockOrder(tradeNo)

		topUp := model.GetTopUpByTradeNo(tradeNo)
		if topUp == nil {
			log.Printf("微信支付回调未找到订单: %s", tradeNo)
			c.JSON(200, gin.H{"code": "SUCCESS", "message": "成功"})
			return
		}

		if topUp.Status == "pending" {
			topUp.Status = "success"
			err := topUp.Update()
			if err != nil {
				log.Printf("微信支付回调更新订单失败: %v", topUp)
				c.JSON(500, gin.H{"code": "FAIL", "message": "更新订单失败"})
				return
			}

			// 给用户充值
			dAmount := decimal.NewFromInt(int64(topUp.Amount))
			dQuotaPerUnit := decimal.NewFromFloat(common.QuotaPerUnit)
			quotaToAdd := int(dAmount.Mul(dQuotaPerUnit).IntPart())
			err = model.IncreaseUserQuota(topUp.UserId, quotaToAdd, true)
			if err != nil {
				log.Printf("微信支付回调更新用户失败: %v", topUp)
				c.JSON(500, gin.H{"code": "FAIL", "message": "更新用户失败"})
				return
			}

			log.Printf("微信支付回调更新用户成功 %v", topUp)
			model.RecordLog(topUp.UserId, model.LogTypeTopup, fmt.Sprintf("使用微信支付充值成功，充值金额: %v，支付金额：%.2f", logger.LogQuota(quotaToAdd), topUp.Money))
		}
	}

	c.JSON(200, gin.H{"code": "SUCCESS", "message": "成功"})
}
