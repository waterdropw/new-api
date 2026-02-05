/*
Copyright (C) 2025 QuantumNous

This program is free software: you can redistribute it and/or modify
it under the terms of the GNU Affero General Public License as
published by the Free Software Foundation, either version 3 of the
License, or (at your option) any later version.

This program is distributed in the hope that it will be useful,
but WITHOUT ANY WARRANTY; without even the implied warranty of
MERCHANTABILITY or FITNESS FOR A PARTICULAR PURPOSE. See the
GNU Affero General Public License for more details.

You should have received a copy of the GNU Affero General Public License
along with this program. If not, see <https://www.gnu.org/licenses/>.

For commercial licensing, please contact support@quantumnous.com
*/

import React, { useEffect, useState } from 'react';
import { Modal, Typography, Spin, Button } from '@douyinfe/semi-ui';
import { SiAlipay, SiWechat } from 'react-icons/si';
import { QRCodeSVG } from 'qrcode.react';
import { API, showError } from '../../../helpers';

const { Text, Title } = Typography;

const QRCodePaymentModal = ({
  t,
  open,
  onCancel,
  qrCode,
  tradeNo,
  paymentMethod,
  amount,
  payMoney,
}) => {
  const [checking, setChecking] = useState(false);
  const [checkTimer, setCheckTimer] = useState(null);

  useEffect(() => {
    if (open && tradeNo) {
      // 开始轮询查询支付状态
      const timer = setInterval(async () => {
        await checkPaymentStatus();
      }, 3000); // 每3秒查询一次

      setCheckTimer(timer);

      return () => {
        if (timer) {
          clearInterval(timer);
        }
      };
    }
  }, [open, tradeNo]);

  const checkPaymentStatus = async () => {
    if (checking) return;

    setChecking(true);
    try {
      // 查询订单状态
      const res = await API.get('/api/user/topup/self');
      const { success, data } = res.data;
      if (success && data?.items) {
        const order = data.items.find((item) => item.trade_no === tradeNo);
        if (order && order.status === 'success') {
          // 支付成功
          if (checkTimer) {
            clearInterval(checkTimer);
          }
          onCancel(true); // 传递true表示支付成功
        }
      }
    } catch (error) {
      // 忽略查询错误
    } finally {
      setChecking(false);
    }
  };

  const getPaymentIcon = () => {
    if (paymentMethod === 'alipay_direct') {
      return <SiAlipay size={32} color='#1677FF' />;
    } else if (paymentMethod === 'wxpay_direct') {
      return <SiWechat size={32} color='#07C160' />;
    }
    return null;
  };

  const getPaymentName = () => {
    if (paymentMethod === 'alipay_direct') {
      return t('支付宝扫码支付');
    } else if (paymentMethod === 'wxpay_direct') {
      return t('微信扫码支付');
    }
    return t('扫码支付');
  };

  return (
    <Modal
      title={
        <div className='flex items-center'>
          {getPaymentIcon()}
          <span style={{ marginLeft: 12 }}>{getPaymentName()}</span>
        </div>
      }
      visible={open}
      onCancel={() => onCancel(false)}
      footer={
        <Button onClick={() => onCancel(false)}>{t('关闭')}</Button>
      }
      maskClosable={false}
      size='small'
      centered
    >
      <div
        style={{
          display: 'flex',
          flexDirection: 'column',
          alignItems: 'center',
          padding: '20px 0',
        }}
      >
        {/* 二维码 */}
        <div
          style={{
            padding: 20,
            background: '#fff',
            borderRadius: 8,
            marginBottom: 20,
          }}
        >
          {qrCode ? (
            <QRCodeSVG value={qrCode} size={256} level='H' />
          ) : (
            <Spin size='large' />
          )}
        </div>

        {/* 支付信息 */}
        <div style={{ textAlign: 'center', width: '100%' }}>
          <Title heading={5} style={{ marginBottom: 12 }}>
            {t('请使用')}
            {paymentMethod === 'alipay_direct' ? t('支付宝') : t('微信')}
            {t('扫码支付')}
          </Title>

          <div
            style={{
              background: 'var(--semi-color-fill-0)',
              padding: '16px',
              borderRadius: '8px',
              marginBottom: '12px',
            }}
          >
            <div
              style={{
                display: 'flex',
                justifyContent: 'space-between',
                marginBottom: '8px',
              }}
            >
              <Text type='secondary'>{t('充值金额')}:</Text>
              <Text strong>{amount} USD</Text>
            </div>
            <div
              style={{
                display: 'flex',
                justifyContent: 'space-between',
              }}
            >
              <Text type='secondary'>{t('支付金额')}:</Text>
              <Text strong style={{ color: 'var(--semi-color-danger)' }}>
                ¥{payMoney}
              </Text>
            </div>
          </div>

          <Text type='tertiary' size='small'>
            {t('订单号')}: {tradeNo}
          </Text>

          {checking && (
            <div style={{ marginTop: 12 }}>
              <Spin size='small' />
              <Text type='tertiary' size='small' style={{ marginLeft: 8 }}>
                {t('正在查询支付状态...')}
              </Text>
            </div>
          )}
        </div>
      </div>
    </Modal>
  );
};

export default QRCodePaymentModal;
