import React from 'react';
import { Brain, AlertCircle, TrendingUp, Zap, Target, BarChart3 } from 'lucide-react';
import { Card } from '@/components/ui/card';
import { Badge } from '@/components/ui/badge';
import { Button } from '@/components/ui/button';
import AppHeader from '@/components/shared/AppHeader';

const models = [
  { name: 'Demand Forecasting', accuracy: 94, predictions: 1240, status: 'active', lastRun: '10 min ago',  icon: TrendingUp },
  { name: 'Fraud Detection',    accuracy: 98, predictions: 3820, status: 'active', lastRun: '2 min ago',   icon: Zap         },
  { name: 'Credit Scoring',     accuracy: 91, predictions: 285,  status: 'active', lastRun: '1 hr ago',    icon: Target      },
  { name: 'Voice Order NLP',    accuracy: 89, predictions: 640,  status: 'active', lastRun: '5 min ago',   icon: Brain       },
  { name: 'Route Optimization', accuracy: 96, predictions: 180,  status: 'active', lastRun: '15 min ago',  icon: BarChart3   },
];

const alerts = [
  {
    type: 'Fraud',
    message: 'Suspicious transaction pattern detected in Laxmipur',
    time: '5 min ago',
    severity: 'high',
  },
  {
    type: 'Demand',
    message: 'Makhana demand spike predicted for next 3 days (+45%)',
    time: '20 min ago',
    severity: 'info',
  },
  {
    type: 'Credit',
    message: 'Customer cu-4421 credit risk score dropped below threshold',
    time: '1 hr ago',
    severity: 'medium',
  },
];

const alertStyle = {
  high:   'border-red-200 bg-red-50/50',
  medium: 'border-amber-200 bg-amber-50/50',
  info:   'border-blue-200 bg-blue-50/50',
};

const badgeStyle = {
  high:   'bg-red-100 text-red-700',
  medium: 'bg-amber-100 text-amber-700',
  info:   'bg-blue-100 text-blue-700',
};

export default function SuperAdminAI() {
  const totalPredictions = models.reduce((s, m) => s + m.predictions, 0);
  const avgAccuracy      = Math.round(models.reduce((s, m) => s + m.accuracy, 0) / models.length);

  return (
    <div className="pb-6">
      <AppHeader title="AI Monitoring" />
      <div className="p-4 space-y-4">

        {/* Summary */}
        <div className="grid grid-cols-3 gap-2 text-center">
          <Card className="p-3 border-border">
            <p className="text-2xl font-bold text-primary">{models.length}</p>
            <p className="text-[10px] text-muted-foreground">Active Models</p>
          </Card>
          <Card className="p-3 border-border">
            <p className="text-2xl font-bold">{(totalPredictions / 1000).toFixed(1)}k</p>
            <p className="text-[10px] text-muted-foreground">Predictions/day</p>
          </Card>
          <Card className="p-3 border-border">
            <p className="text-2xl font-bold text-green-600">{avgAccuracy}%</p>
            <p className="text-[10px] text-muted-foreground">Avg Accuracy</p>
          </Card>
        </div>

        {/* Models */}
        <Card className="p-4 border-border">
          <h3 className="font-semibold text-sm mb-3 flex items-center gap-2">
            <Brain className="w-4 h-4 text-primary" /> AI Models
          </h3>
          <div className="space-y-3">
            {models.map(m => {
              const Icon = m.icon;
              return (
                <div key={m.name} className="flex items-center gap-3">
                  <div className="w-8 h-8 rounded-lg bg-primary/10 flex items-center justify-center shrink-0">
                    <Icon className="w-4 h-4 text-primary" />
                  </div>
                  <div className="flex-1 min-w-0">
                    <div className="flex items-center justify-between">
                      <p className="text-sm font-medium">{m.name}</p>
                      <span className="text-xs text-muted-foreground">{m.predictions.toLocaleString()} pred.</span>
                    </div>
                    <div className="h-1.5 bg-muted rounded-full overflow-hidden mt-1">
                      <div
                        className="h-full bg-primary rounded-full"
                        style={{ width: `${m.accuracy}%` }}
                      />
                    </div>
                    <p className="text-[10px] text-muted-foreground mt-0.5">
                      {m.accuracy}% accuracy · {m.lastRun}
                    </p>
                  </div>
                </div>
              );
            })}
          </div>
        </Card>

        {/* Alerts */}
        <Card className="p-4 border-border">
          <h3 className="font-semibold text-sm mb-3 flex items-center gap-2">
            <AlertCircle className="w-4 h-4 text-primary" /> Recent AI Alerts
          </h3>
          <div className="space-y-2">
            {alerts.map((alert, i) => (
              <Card key={i} className={`p-3 border ${alertStyle[alert.severity]}`}>
                <div className="flex items-start justify-between">
                  <div className="flex-1 min-w-0">
                    <Badge className={`text-[9px] border-0 mb-1 ${badgeStyle[alert.severity]}`}>
                      {alert.type}
                    </Badge>
                    <p className="text-xs">{alert.message}</p>
                    <p className="text-[10px] text-muted-foreground mt-0.5">{alert.time}</p>
                  </div>
                  {alert.severity !== 'info' && (
                    <Button size="sm" variant="outline" className="h-7 text-xs ml-2 shrink-0">
                      Review
                    </Button>
                  )}
                </div>
              </Card>
            ))}
          </div>
        </Card>

        {/* Model management */}
        <Card className="p-4 border-border">
          <h3 className="font-semibold text-sm mb-3">Model Management</h3>
          <div className="space-y-2">
            {[
              { label: 'Retrain All Models',    variant: 'outline' },
              { label: 'Export Model Reports',  variant: 'outline' },
              { label: 'Configure Thresholds',  variant: 'outline' },
            ].map(btn => (
              <Button key={btn.label} variant={btn.variant} className="w-full justify-start text-sm h-9">
                {btn.label}
              </Button>
            ))}
          </div>
        </Card>
      </div>
    </div>
  );
}
