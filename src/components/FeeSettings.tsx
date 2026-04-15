import { useState, useEffect } from 'react';
import { useStore } from '@/store/useStore';
import { useAuth } from '@/contexts/AuthContext';
import { FeeConfig } from '@/lib/types';
import { IndianRupee, Check, Loader2, Settings, AlertCircle } from 'lucide-react';
import { toast } from 'sonner';


import { getClassName } from '@/lib/data-utils';

const getClassBadgeLabel = (className: string) => {
  if (!className) return '';
  const numMatch = className.match(/\d+/);
  if (numMatch) return numMatch[0];
  return className.charAt(0).toUpperCase();
};

const FeeSettings = ({ schoolId }: { schoolId: string }) => {
    const { role } = useAuth();
    const { feeConfigs, saveFeeConfig, loading, classes: storeClasses } = useStore();

    // Local draft state: classId -> FeeConfig
    const [drafts, setDrafts] = useState<Record<string, { totalFee: string; transport: string }>>({});
    const [saving, setSaving] = useState<string | null>(null);

    // Initialize drafts from existing configs
    useEffect(() => {
        const initial: Record<string, { totalFee: string; transport: string }> = {};
        storeClasses.forEach(cls => {
            const classId = cls.classId;
            const existing = feeConfigs.find(c => c.classId === classId);
            initial[classId] = {
                totalFee: existing ? existing.totalFee.toString() : '',
                transport: existing?.optionalCharges?.transport ? existing.optionalCharges.transport.toString() : '',
            };
        });
        setDrafts(initial);
    }, [feeConfigs, storeClasses]);

    const handleSave = async (classId: string) => {
        const draft = drafts[classId];
        const totalFee = parseFloat(draft.totalFee);
        if (isNaN(totalFee) || totalFee < 0) {
            toast.error(`Enter a valid total fee for ${getClassName(classId, storeClasses)}`);
            return;
        }
        setSaving(classId);
        const config: FeeConfig = {
            classId,
            totalFee,
            optionalCharges: {
                transport: parseFloat(draft.transport) || 0,
            },
        };
        try {
            await saveFeeConfig(schoolId, config);
            toast.success(`Fee structure saved for ${getClassName(classId, storeClasses)}`);
        } catch {
            toast.error('Failed to save. Please try again.');
        } finally {
            setSaving(null);
        }
    };

    const updateDraft = (classId: string, field: 'totalFee' | 'transport', value: string) => {
        setDrafts(d => ({ ...d, [classId]: { ...d[classId], [field]: value } }));
    };

    const hasConfig = (classId: string) => feeConfigs.some(c => c.classId === classId);

    if (loading.feeConfigs) {
        return (
            <div className="flex flex-col items-center justify-center py-20 gap-3">
                <Loader2 className="w-8 h-8 text-primary animate-spin" />
                <p className="text-muted-foreground text-sm font-medium">Loading fee structures...</p>
            </div>
        );
    }

    const configuredCount = storeClasses.filter(c => hasConfig(c.classId)).length;

    return (
        <div className="space-y-6">
            <div className="flex items-center justify-between">
                <div>
                    <h2 className="text-xl font-display font-bold text-foreground">Class-wise Monthly Fee Configuration</h2>
                    <p className="text-sm text-muted-foreground mt-0.5">
                        Define standard monthly fee per class. These auto-fill during student registration and regular updates.
                    </p>
                </div>
                <div className="flex items-center gap-2 px-4 py-2 bg-primary/10 border border-primary/20 rounded-xl">
                    <Settings className="w-4 h-4 text-primary" />
                    <span className="text-sm font-semibold text-primary">{configuredCount}/{storeClasses.length} configured</span>
                </div>
            </div>

            {configuredCount === 0 && (
                <div className="flex items-center gap-3 p-4 bg-warning/10 border border-warning/30 rounded-xl text-warning text-sm font-medium">
                    <AlertCircle className="w-5 h-5 flex-shrink-0" />
                    No fee structures configured. Set the baseline monthly fee for each class to enable auto-fill during updates.
                </div>
            )}

            <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 gap-4">
                {[...storeClasses].sort((a, b) => a.order - b.order).map(cls => {
                    const classId = cls.classId;
                    const draft = drafts[classId] || { totalFee: '', transport: '' };
                    const configured = hasConfig(classId);
                    const isSaving = saving === classId;
                    const existingConfig = feeConfigs.find(c => c.classId === classId);

                    return (
                        <div
                            key={classId}
                            className={`bg-card border rounded-xl p-4 space-y-3 transition-all duration-200 ${configured ? 'border-primary/30 shadow-sm' : 'border-border'}`}
                        >
                            <div className="flex items-center justify-between">
                                <div className="flex items-center gap-2">
                                    <div className={`w-8 h-8 rounded-full flex items-center justify-center text-sm font-bold ${configured ? 'bg-primary text-primary-foreground' : 'bg-muted text-muted-foreground'}`}>
                                        {getClassBadgeLabel(cls.name)}
                                    </div>
                                    <div>
                                        <p className="text-sm font-semibold text-foreground">{cls.name}</p>
                                        <p className="text-[10px] text-muted-foreground font-medium uppercase tracking-wide">
                                            {configured ? 'Configured' : 'Not set'}
                                        </p>
                                    </div>
                                </div>
                                {configured && (
                                    <div className="flex items-center gap-1 text-[10px] font-bold text-success uppercase tracking-wide">
                                        <Check className="w-3 h-3" />
                                        Active
                                    </div>
                                )}
                            </div>

                            <div className="space-y-2">
                                <div>
                                    <label className="block text-xs font-medium text-muted-foreground mb-1">
                                        Standard Monthly Fee (₹)
                                    </label>
                                    <div className="relative">
                                        <IndianRupee className="absolute left-2.5 top-1/2 -translate-y-1/2 w-3.5 h-3.5 text-muted-foreground" />
                                        <input
                                            type="number"
                                            value={draft.totalFee}
                                            onChange={e => updateDraft(classId, 'totalFee', e.target.value)}
                                            placeholder="e.g. 35000"
                                            className="w-full pl-7 pr-3 py-2 text-sm bg-muted/50 border border-border rounded-lg text-foreground focus:outline-none focus:ring-2 focus:ring-ring"
                                        />
                                    </div>
                                </div>

                                <div>
                                    <label className="block text-xs font-medium text-muted-foreground mb-1">
                                        Transport Fee (₹) <span className="text-muted-foreground/60">optional</span>
                                    </label>
                                    <input
                                        type="number"
                                        value={draft.transport}
                                        onChange={e => updateDraft(classId, 'transport', e.target.value)}
                                        placeholder="e.g. 3000"
                                        className="w-full px-3 py-2 text-sm bg-muted/50 border border-border rounded-lg text-foreground focus:outline-none focus:ring-2 focus:ring-ring"
                                    />
                                </div>
                            </div>

                            {existingConfig && (
                                <div className="text-xs text-muted-foreground bg-muted/30 rounded-lg px-3 py-1.5">
                                    Current: ₹{existingConfig.totalFee.toLocaleString()}
                                    {existingConfig.optionalCharges?.transport ? ` + ₹${existingConfig.optionalCharges.transport.toLocaleString()} transport` : ''}
                                </div>
                            )}

                            <button
                                onClick={() => handleSave(classId)}
                                disabled={isSaving || !draft.totalFee || !['admin', 'accountant'].includes(role || '')}
                                className="w-full flex items-center justify-center gap-2 py-2 bg-primary text-primary-foreground rounded-lg text-sm font-semibold hover:opacity-90 transition-opacity disabled:opacity-50"
                            >
                                {isSaving ? (
                                    <><Loader2 className="w-3.5 h-3.5 animate-spin" /> Saving...</>
                                ) : (
                                    <><Check className="w-3.5 h-3.5" /> {!['admin', 'accountant'].includes(role || '') ? 'Restricted' : configured ? 'Update' : 'Save'} Fee</>
                                )}
                            </button>
                        </div>
                    );
                })}
            </div>
        </div>
    );
};

export default FeeSettings;
