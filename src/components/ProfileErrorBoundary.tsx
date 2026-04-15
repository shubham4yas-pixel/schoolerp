import React, { Component, ReactNode } from 'react';
import AppLayout from '@/components/AppLayout';
import { AlertTriangle } from 'lucide-react';

interface Props {
    onReset: () => void;
    children: ReactNode;
}

interface State {
    hasError: boolean;
}

class ProfileErrorBoundary extends Component<Props, State> {
    constructor(props: Props) {
        super(props);
        this.state = { hasError: false };
    }

    static getDerivedStateFromError() {
        return { hasError: true };
    }

    componentDidCatch(error: Error) {
        console.error('[ProfileErrorBoundary] Caught render error:', error);
    }

    render() {
        if (this.state.hasError) {
            return (
                <AppLayout title="Student Profile">
                    <div className="flex flex-col items-center justify-center min-h-[400px] gap-4">
                        <div className="w-14 h-14 rounded-xl bg-destructive/10 flex items-center justify-center">
                            <AlertTriangle className="w-7 h-7 text-destructive" />
                        </div>
                        <div className="text-center">
                            <h2 className="text-lg font-semibold text-foreground mb-1">Profile failed to load</h2>
                            <p className="text-muted-foreground text-sm">An unexpected error occurred rendering this profile.</p>
                        </div>
                        <div className="flex gap-3">
                            <button
                                onClick={() => {
                                    this.setState({ hasError: false });
                                    this.props.onReset();
                                }}
                                className="px-5 py-2 bg-primary text-primary-foreground rounded-lg text-sm font-medium hover:opacity-90 transition-opacity"
                            >
                                Go Back
                            </button>
                            <button
                                onClick={() => window.location.reload()}
                                className="px-5 py-2 bg-muted text-foreground rounded-lg text-sm font-medium hover:bg-muted/80 transition-colors"
                            >
                                Reload
                            </button>
                        </div>
                    </div>
                </AppLayout>
            );
        }
        return this.props.children;
    }
}

export default ProfileErrorBoundary;


