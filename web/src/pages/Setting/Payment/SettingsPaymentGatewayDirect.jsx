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

import React, { useEffect, useState, useRef } from 'react';
import { Button, Form, Row, Col, Typography, Spin, Banner } from '@douyinfe/semi-ui';
const { Text } = Typography;
import { API, showError, showSuccess } from '../../../helpers';
import { useTranslation } from 'react-i18next';

export default function SettingsPaymentGatewayDirect(props) {
  const { t } = useTranslation();
  const [loading, setLoading] = useState(false);
  const [inputs, setInputs] = useState({
    AlipayEnabled: false,
    AlipayAppId: '',
    AlipayPrivateKey: '',
    AlipayPublicKey: '',
    AlipayIsProd: false,
    WxpayEnabled: false,
    WxpayAppId: '',
    WxpayMchId: '',
    WxpayApiV3Key: '',
    WxpayCertSerial: '',
    WxpayPrivateKey: '',
  });
  const [originInputs, setOriginInputs] = useState({});
  const formApiRef = useRef(null);

  useEffect(() => {
    if (props.options && formApiRef.current) {
      const currentInputs = {
        AlipayEnabled: props.options.AlipayEnabled || false,
        AlipayAppId: props.options.AlipayAppId || '',
        AlipayPrivateKey: props.options.AlipayPrivateKey || '',
        AlipayPublicKey: props.options.AlipayPublicKey || '',
        AlipayIsProd: props.options.AlipayIsProd || false,
        WxpayEnabled: props.options.WxpayEnabled || false,
        WxpayAppId: props.options.WxpayAppId || '',
        WxpayMchId: props.options.WxpayMchId || '',
        WxpayApiV3Key: props.options.WxpayApiV3Key || '',
        WxpayCertSerial: props.options.WxpayCertSerial || '',
        WxpayPrivateKey: props.options.WxpayPrivateKey || '',
      };

      setInputs(currentInputs);
      setOriginInputs({ ...currentInputs });
      formApiRef.current.setValues(currentInputs);
    }
  }, [props.options]);

  const handleFormChange = (values) => {
    setInputs(values);
  };

  const submitDirectPayment = async () => {
    setLoading(true);
    try {
      const options = [];

      // 支付宝配置
      if (originInputs['AlipayEnabled'] !== inputs.AlipayEnabled) {
        options.push({
          key: 'AlipayEnabled',
          value: inputs.AlipayEnabled.toString(),
        });
      }
      if (inputs.AlipayAppId !== '') {
        options.push({ key: 'AlipayAppId', value: inputs.AlipayAppId });
      }
      if (inputs.AlipayPrivateKey !== '' && inputs.AlipayPrivateKey !== undefined) {
        options.push({
          key: 'AlipayPrivateKey',
          value: inputs.AlipayPrivateKey,
        });
      }
      if (inputs.AlipayPublicKey !== '' && inputs.AlipayPublicKey !== undefined) {
        options.push({
          key: 'AlipayPublicKey',
          value: inputs.AlipayPublicKey,
        });
      }
      if (originInputs['AlipayIsProd'] !== inputs.AlipayIsProd) {
        options.push({
          key: 'AlipayIsProd',
          value: inputs.AlipayIsProd.toString(),
        });
      }

      // 微信支付配置
      if (originInputs['WxpayEnabled'] !== inputs.WxpayEnabled) {
        options.push({
          key: 'WxpayEnabled',
          value: inputs.WxpayEnabled.toString(),
        });
      }
      if (inputs.WxpayAppId !== '') {
        options.push({ key: 'WxpayAppId', value: inputs.WxpayAppId });
      }
      if (inputs.WxpayMchId !== '') {
        options.push({ key: 'WxpayMchId', value: inputs.WxpayMchId });
      }
      if (inputs.WxpayApiV3Key !== '' && inputs.WxpayApiV3Key !== undefined) {
        options.push({ key: 'WxpayApiV3Key', value: inputs.WxpayApiV3Key });
      }
      if (inputs.WxpayCertSerial !== '') {
        options.push({
          key: 'WxpayCertSerial',
          value: inputs.WxpayCertSerial,
        });
      }
      if (inputs.WxpayPrivateKey !== '' && inputs.WxpayPrivateKey !== undefined) {
        options.push({
          key: 'WxpayPrivateKey',
          value: inputs.WxpayPrivateKey,
        });
      }

      // 发送请求
      const requestQueue = options.map((opt) =>
        API.put('/api/option/', {
          key: opt.key,
          value: opt.value,
        }),
      );

      const results = await Promise.all(requestQueue);

      // 检查所有请求是否成功
      const errorResults = results.filter((res) => !res.data.success);
      if (errorResults.length > 0) {
        errorResults.forEach((res) => {
          showError(res.data.message);
        });
      } else {
        showSuccess(t('更新成功'));
        // 更新本地存储的原始值
        setOriginInputs({ ...inputs });
        props.refresh && props.refresh();
      }
    } catch (error) {
      showError(t('更新失败'));
    }
    setLoading(false);
  };

  return (
    <Spin spinning={loading}>
      <Form
        initValues={inputs}
        onValueChange={handleFormChange}
        getFormApi={(api) => (formApiRef.current = api)}
      >
        <Form.Section text={t('支付宝官方直连支付')}>
          <Banner
            type='info'
            description={t(
              '使用支付宝官方当面付接口，需要企业资质。安全性高，费率低。',
            )}
            style={{ marginBottom: 16 }}
          />
          <Form.Switch
            field='AlipayEnabled'
            label={t('启用支付宝直连支付')}
          />
          <Row gutter={{ xs: 8, sm: 16, md: 24, lg: 24, xl: 24, xxl: 24 }}>
            <Col xs={24} sm={24} md={12} lg={12} xl={12}>
              <Form.Input
                field='AlipayAppId'
                label={t('支付宝应用APPID')}
                placeholder={t('例如：2021001122334455')}
              />
            </Col>
            <Col xs={24} sm={24} md={12} lg={12} xl={12}>
              <Form.Switch
                field='AlipayIsProd'
                label={t('生产环境')}
                helpText={t('开启表示正式环境，关闭表示沙箱环境')}
              />
            </Col>
          </Row>
          <Form.TextArea
            field='AlipayPrivateKey'
            label={t('应用私钥')}
            placeholder={t('敏感信息不会发送到前端显示')}
            rows={5}
            helpText={t('填写完整的应用私钥内容，包含开头结尾标识')}
          />
          <Form.TextArea
            field='AlipayPublicKey'
            label={t('支付宝公钥')}
            placeholder={t('敏感信息不会发送到前端显示')}
            rows={5}
            helpText={t('填写支付宝公钥内容（从支付宝开放平台获取）')}
          />
        </Form.Section>

        <Form.Section text={t('微信支付官方直连支付')} style={{ marginTop: 32 }}>
          <Banner
            type='info'
            description={t(
              '使用微信支付Native接口，需要企业资质。安全性高，费率低。',
            )}
            style={{ marginBottom: 16 }}
          />
          <Form.Switch
            field='WxpayEnabled'
            label={t('启用微信支付直连')}
          />
          <Row gutter={{ xs: 8, sm: 16, md: 24, lg: 24, xl: 24, xxl: 24 }}>
            <Col xs={24} sm={24} md={12} lg={12} xl={12}>
              <Form.Input
                field='WxpayAppId'
                label={t('微信应用APPID')}
                placeholder={t('例如：wx1234567890abcdef')}
              />
            </Col>
            <Col xs={24} sm={24} md={12} lg={12} xl={12}>
              <Form.Input
                field='WxpayMchId'
                label={t('商户号')}
                placeholder={t('例如：1234567890')}
              />
            </Col>
          </Row>
          <Row
            gutter={{ xs: 8, sm: 16, md: 24, lg: 24, xl: 24, xxl: 24 }}
            style={{ marginTop: 16 }}
          >
            <Col xs={24} sm={24} md={12} lg={12} xl={12}>
              <Form.Input
                field='WxpayApiV3Key'
                label={t('APIv3密钥')}
                placeholder={t('敏感信息不会发送到前端显示')}
                type='password'
                helpText={t('32位API密钥')}
              />
            </Col>
            <Col xs={24} sm={24} md={12} lg={12} xl={12}>
              <Form.Input
                field='WxpayCertSerial'
                label={t('证书序列号')}
                placeholder={t('例如：5ABCD...')}
                helpText={t('商户API证书的序列号')}
              />
            </Col>
          </Row>
          <Form.TextArea
            field='WxpayPrivateKey'
            label={t('商户私钥')}
            placeholder={t('敏感信息不会发送到前端显示')}
            rows={5}
            helpText={t(
              '填写商户私钥文件内容或私钥文件路径（服务器本地路径）',
            )}
          />
        </Form.Section>

        <Button onClick={submitDirectPayment} style={{ marginTop: 16 }}>
          {t('更新支付配置')}
        </Button>
      </Form>
    </Spin>
  );
}
