import React, { useEffect, useState } from 'react';
import { Button, Toast, Form, Checkbox, Space, PageHeader, Select, Card } from '@douyinfe/semi-ui';
import { useTranslation } from 'react-i18next';
import { API } from '../../../helpers/api.js';
import HTTPCLIENT from '../../../helpers/secureApiCall';

export default function SettingsRetry() {
  const { t } = useTranslation();
  const [retrySetting, setRetrySetting] = useState(null);
  const [loading, setLoading] = useState(true);
  const [saveLoading, setSaveLoading] = useState(false);

  useEffect(() => {
    loadRetrySetting();
  }, []);

  const loadRetrySetting = async () => {
    try {
      setLoading(true);
      const res = await HTTPCLIENT.get('/api/option/retry');
      if (res.data.success) {
        setRetrySetting(res.data.data);
      } else {
        Toast.error(res.data.message || 'Failed to load retry settings');
      }
    } catch (error) {
      Toast.error(error.message || 'Failed to load retry settings');
    } finally {
      setLoading(false);
    }
  };

  const handleSave = async () => {
    try {
      setSaveLoading(true);
      const res = await HTTPCLIENT.put('/api/option/retry', retrySetting);
      if (res.data.success) {
        Toast.success('Retry settings updated successfully');
      } else {
        Toast.error(res.data.message || 'Failed to update retry settings');
      }
    } catch (error) {
      Toast.error(error.message || 'Failed to update retry settings');
    } finally {
      setSaveLoading(false);
    }
  };

  const updateSetting = (key, value) => {
    setRetrySetting(prev => ({
      ...prev,
      [key]: value
    }));
  };

  if (loading || !retrySetting) {
    return <div>Loading...</div>;
  }

  const strategyOptions = [
    { label: 'Fixed Delay', value: 'fixed' },
    { label: 'Linear Backoff', value: 'linear' },
    { label: 'Exponential Backoff', value: 'exponent' }
  ];

  return (
    <div>
      <PageHeader title="Retry Settings" />
      <Space spacing="large" direction="vertical" style={{ width: '100%' }}>
        {/* Basic Configuration */}
        <Card title="Basic Configuration" style={{ width: '100%' }}>
          <Form layout="vertical">
            <Form.InputNumber
              label="Max Retry Attempts"
              value={retrySetting.MaxRetryAttempts}
              onChange={(val) => updateSetting('MaxRetryAttempts', val)}
              min={0}
              max={10}
            />
            <Form.Select
              label="Retry Strategy"
              value={retrySetting.RetryStrategy}
              onChange={(val) => updateSetting('RetryStrategy', val)}
              optionList={strategyOptions}
              style={{ marginTop: '12px' }}
            />
            <Form.InputNumber
              label="Base Retry Delay (milliseconds)"
              value={retrySetting.BaseRetryDelayMs}
              onChange={(val) => updateSetting('BaseRetryDelayMs', val)}
              min={0}
              step={100}
              style={{ marginTop: '12px' }}
            />
            <Form.InputNumber
              label="Max Retry Delay (milliseconds)"
              value={retrySetting.MaxRetryDelayMs}
              onChange={(val) => updateSetting('MaxRetryDelayMs', val)}
              min={0}
              step={1000}
              style={{ marginTop: '12px' }}
            />
          </Form>
        </Card>

        {/* Retry Conditions */}
        <Card title="Retry Conditions" style={{ width: '100%' }}>
          <Form layout="vertical">
            <Form.CheckboxGroup
              value={
                [
                  retrySetting.RetryOnTimeout && 'retryOnTimeout',
                  retrySetting.RetryOn5xx && 'retryOn5xx',
                  retrySetting.RetryOn429 && 'retryOn429',
                  retrySetting.RetryOnConnectionError && 'retryOnConnectionError'
                ].filter(Boolean)
              }
              onChange={(values) => {
                updateSetting('RetryOnTimeout', values.includes('retryOnTimeout'));
                updateSetting('RetryOn5xx', values.includes('retryOn5xx'));
                updateSetting('RetryOn429', values.includes('retryOn429'));
                updateSetting('RetryOnConnectionError', values.includes('retryOnConnectionError'));
              }}
              options={[
                { label: 'Retry on Timeout', value: 'retryOnTimeout' },
                { label: 'Retry on 5xx Errors', value: 'retryOn5xx' },
                { label: 'Retry on 429 (Rate Limit)', value: 'retryOn429' },
                { label: 'Retry on Connection Error', value: 'retryOnConnectionError' }
              ]}
            />
          </Form>
        </Card>

        {/* Performance Related */}
        <Card title="Performance Related" style={{ width: '100%' }}>
          <Form layout="vertical">
            <Form.Checkbox
              checked={retrySetting.EnableRetryQueue}
              onChange={(e) => updateSetting('EnableRetryQueue', e.target.checked)}
            >
              Enable Retry Queue Management
            </Form.Checkbox>
            <Form.InputNumber
              label="Max Retry Queue Size"
              value={retrySetting.MaxRetryQueueSize}
              onChange={(val) => updateSetting('MaxRetryQueueSize', val)}
              min={1}
              style={{ marginTop: '12px' }}
            />
            <Form.InputNumber
              label="Retry Timeout (seconds)"
              value={retrySetting.RetryTimeoutSeconds}
              onChange={(val) => updateSetting('RetryTimeoutSeconds', val)}
              min={1}
              style={{ marginTop: '12px' }}
            />
          </Form>
        </Card>

        {/* Circuit Breaker */}
        <Card title="Circuit Breaker" style={{ width: '100%' }}>
          <Form layout="vertical">
            <Form.Checkbox
              checked={retrySetting.CircuitBreakerEnabled}
              onChange={(e) => updateSetting('CircuitBreakerEnabled', e.target.checked)}
            >
              Enable Circuit Breaker (Prevent Cascade Failures)
            </Form.Checkbox>
            <Form.InputNumber
              label="Circuit Breaker Threshold"
              value={retrySetting.CircuitBreakerThreshold}
              onChange={(val) => updateSetting('CircuitBreakerThreshold', val)}
              min={1}
              style={{ marginTop: '12px' }}
            />
            <Form.InputNumber
              label="Circuit Breaker Reset Time (seconds)"
              value={retrySetting.CircuitBreakerResetSeconds}
              onChange={(val) => updateSetting('CircuitBreakerResetSeconds', val)}
              min={1}
              step={10}
              style={{ marginTop: '12px' }}
            />
          </Form>
        </Card>

        {/* Action Buttons */}
        <Space>
          <Button onClick={handleSave} loading={saveLoading} type="primary">
            Save Changes
          </Button>
          <Button onClick={loadRetrySetting}>
            Reload
          </Button>
        </Space>
      </Space>
    </div>
  );
}
