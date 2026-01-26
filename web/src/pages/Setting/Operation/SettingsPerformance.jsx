import React, { useEffect, useState } from 'react';
import { Button, Toast, Form, Checkbox, SideSheet, Layout, PageHeader, Space, Tooltip, Card } from '@douyinfe/semi-ui';
import { useTranslation } from 'react-i18next';
import { API } from '../../../helpers/api.js';
import HTTPCLIENT from '../../../helpers/secureApiCall';

export default function SettingsPerformance() {
  const { t } = useTranslation();
  const [performanceSetting, setPerformanceSetting] = useState(null);
  const [loading, setLoading] = useState(true);
  const [saveLoading, setSaveLoading] = useState(false);

  useEffect(() => {
    loadPerformanceSetting();
  }, []);

  const loadPerformanceSetting = async () => {
    try {
      setLoading(true);
      const res = await HTTPCLIENT.get('/api/option/performance');
      if (res.data.success) {
        setPerformanceSetting(res.data.data);
      } else {
        Toast.error(res.data.message || 'Failed to load performance settings');
      }
    } catch (error) {
      Toast.error(error.message || 'Failed to load performance settings');
    } finally {
      setLoading(false);
    }
  };

  const handleSave = async () => {
    try {
      setSaveLoading(true);
      const res = await HTTPCLIENT.put('/api/option/performance', performanceSetting);
      if (res.data.success) {
        Toast.success('Performance settings updated successfully');
      } else {
        Toast.error(res.data.message || 'Failed to update performance settings');
      }
    } catch (error) {
      Toast.error(error.message || 'Failed to update performance settings');
    } finally {
      setSaveLoading(false);
    }
  };

  const updateSetting = (key, value) => {
    setPerformanceSetting(prev => ({
      ...prev,
      [key]: value
    }));
  };

  if (loading || !performanceSetting) {
    return <div>Loading...</div>;
  }

  return (
    <div>
      <PageHeader title="Performance Settings" />
      <Space spacing="large" direction="vertical" style={{ width: '100%' }}>
        {/* Stream Mode Optimization */}
        <Card title="Stream Mode Optimization" style={{ width: '100%' }}>
          <Form layout="vertical">
            <Form.Section text="Stream mode optimization can reduce approximately 5% CPU usage in Docker deployments">
              <Form.CheckboxGroup
                value={
                  [
                    performanceSetting.StreamModeEnabled && 'streamModeEnabled',
                    performanceSetting.EnableStreamBackPressure && 'enableStreamBackPressure'
                  ].filter(Boolean)
                }
                onChange={(values) => {
                  updateSetting('StreamModeEnabled', values.includes('streamModeEnabled'));
                  updateSetting('EnableStreamBackPressure', values.includes('enableStreamBackPressure'));
                }}
                options={[
                  { label: 'Enable Stream Mode', value: 'streamModeEnabled' },
                  { label: 'Enable Back Pressure Control', value: 'enableStreamBackPressure' }
                ]}
              />
              <div style={{ marginTop: '16px' }}>
                <Form.InputNumber
                  label="Stream Buffer Size (KB)"
                  value={performanceSetting.StreamBufferSizeKB}
                  onChange={(val) => updateSetting('StreamBufferSizeKB', val)}
                  step={1}
                  min={1}
                />
                <Form.InputNumber
                  label="Stream Chunk Size (Bytes)"
                  value={performanceSetting.StreamChunkSizeBytes}
                  onChange={(val) => updateSetting('StreamChunkSizeBytes', val)}
                  step={1024}
                  min={512}
                  style={{ marginTop: '12px' }}
                />
              </div>
            </Form.Section>
          </Form>
        </Card>

        {/* Concurrency Control */}
        <Card title="Concurrency Control" style={{ width: '100%' }}>
          <Form layout="vertical">
            <Form.InputNumber
              label="Max Concurrent Requests (0 = unlimited)"
              value={performanceSetting.MaxConcurrentRequests}
              onChange={(val) => updateSetting('MaxConcurrentRequests', val)}
              min={0}
            />
            <Form.InputNumber
              label="Max Goroutine per Request"
              value={performanceSetting.MaxGoroutinePerRequest}
              onChange={(val) => updateSetting('MaxGoroutinePerRequest', val)}
              min={1}
              style={{ marginTop: '12px' }}
            />
            <Form.InputNumber
              label="Goroutine Pool Size"
              value={performanceSetting.GoroutinePoolSize}
              onChange={(val) => updateSetting('GoroutinePoolSize', val)}
              min={1}
              style={{ marginTop: '12px' }}
            />
            <Form.Checkbox
              checked={performanceSetting.EnableGoroutineAlarm}
              onChange={(e) => updateSetting('EnableGoroutineAlarm', e.target.checked)}
              style={{ marginTop: '12px' }}
            >
              Enable Goroutine Alarm
            </Form.Checkbox>
          </Form>
        </Card>

        {/* Memory Management */}
        <Card title="Memory Management" style={{ width: '100%' }}>
          <Form layout="vertical">
            <Form.Checkbox
              checked={performanceSetting.EnableMemoryOptimization}
              onChange={(e) => updateSetting('EnableMemoryOptimization', e.target.checked)}
            >
              Enable Memory Optimization
            </Form.Checkbox>
            <Form.InputNumber
              label="Max Memory Usage Percent (0 = unlimited)"
              value={performanceSetting.MaxMemoryUsagePercent}
              onChange={(val) => updateSetting('MaxMemoryUsagePercent', val)}
              min={0}
              max={100}
              style={{ marginTop: '12px' }}
            />
            <Form.InputNumber
              label="Memory Alarm Threshold (%)"
              value={performanceSetting.MemoryAlarmThresholdPercent}
              onChange={(val) => updateSetting('MemoryAlarmThresholdPercent', val)}
              min={0}
              max={100}
              style={{ marginTop: '12px' }}
            />
          </Form>
        </Card>

        {/* Connection Pool Optimization */}
        <Card title="Connection Pool Optimization" style={{ width: '100%' }}>
          <Form layout="vertical">
            <Form.Checkbox
              checked={performanceSetting.EnableConnectionPoolOptimization}
              onChange={(e) => updateSetting('EnableConnectionPoolOptimization', e.target.checked)}
            >
              Enable Connection Pool Optimization
            </Form.Checkbox>
            <Form.InputNumber
              label="Max Idle Connections"
              value={performanceSetting.MaxIdleConns}
              onChange={(val) => updateSetting('MaxIdleConns', val)}
              min={1}
              style={{ marginTop: '12px' }}
            />
            <Form.InputNumber
              label="Max Idle Connections per Host"
              value={performanceSetting.MaxIdleConnsPerHost}
              onChange={(val) => updateSetting('MaxIdleConnsPerHost', val)}
              min={1}
              style={{ marginTop: '12px' }}
            />
            <Form.InputNumber
              label="Idle Connection Timeout (seconds)"
              value={performanceSetting.IdleConnTimeout}
              onChange={(val) => updateSetting('IdleConnTimeout', val)}
              min={1}
              style={{ marginTop: '12px' }}
            />
          </Form>
        </Card>

        {/* Response Caching */}
        <Card title="Response Caching" style={{ width: '100%' }}>
          <Form layout="vertical">
            <Form.Checkbox
              checked={performanceSetting.EnableResponseCache}
              onChange={(e) => updateSetting('EnableResponseCache', e.target.checked)}
            >
              Enable Response Cache
            </Form.Checkbox>
            <Form.InputNumber
              label="Cache TTL (seconds)"
              value={performanceSetting.CacheTTLSeconds}
              onChange={(val) => updateSetting('CacheTTLSeconds', val)}
              min={1}
              style={{ marginTop: '12px' }}
            />
          </Form>
        </Card>

        {/* CPU Optimization */}
        <Card title="CPU Optimization" style={{ width: '100%' }}>
          <Form layout="vertical">
            <Form.CheckboxGroup
              value={
                [
                  performanceSetting.EnableCPUOptimization && 'enableCPUOptimization',
                  performanceSetting.ReduceMutexContention && 'reduceMutexContention'
                ].filter(Boolean)
              }
              onChange={(values) => {
                updateSetting('EnableCPUOptimization', values.includes('enableCPUOptimization'));
                updateSetting('ReduceMutexContention', values.includes('reduceMutexContention'));
              }}
              options={[
                { label: 'Enable CPU Optimization', value: 'enableCPUOptimization' },
                { label: 'Reduce Mutex Contention', value: 'reduceMutexContention' }
              ]}
            />
          </Form>
        </Card>

        {/* Action Buttons */}
        <Space>
          <Button onClick={handleSave} loading={saveLoading} type="primary">
            Save Changes
          </Button>
          <Button onClick={loadPerformanceSetting}>
            Reload
          </Button>
        </Space>
      </Space>
    </div>
  );
}
