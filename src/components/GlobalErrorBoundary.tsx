import React, { ErrorInfo, ReactNode } from 'react';
import { AlertTriangle, RotateCcw } from 'lucide-react';

interface Props {
    children: ReactNode;
}

interface State {
    hasError: boolean;
    error?: Error;
}

class GlobalErrorBoundary extends React.Component<Props, State> {
    constructor(props: Props) {
        super(props);
        this.state = { hasError: false };
    }

    static getDerivedStateFromError(error: Error): State {
        return { hasError: true, error };
    }

    componentDidCatch(error: Error, errorInfo: ErrorInfo) {
        console.error("App Crash Detected:", error, errorInfo);
    }

    handleReset = () => {
        this.setState({ hasError: false });
        window.location.reload();
    };

    render() {
        if (this.state.hasError) {
            return (
                <div className="flex flex-col items-center justify-center min-h-screen bg-background p-6 text-center">
                    <div className="w-16 h-16 bg-destructive/10 rounded-2xl flex items-center justify-center mb-6">
                        <AlertTriangle className="w-8 h-8 text-destructive" />
                    </div>
                    <h1 className="text-2xl font-display font-bold text-foreground mb-2">Something went wrong</h1>
                    <p className="text-muted-foreground max-w-md mb-8">
                        The application encountered an unexpected error. Don't worry, your data is safe in the cloud.
                    </p>
                    <button
                        onClick={this.handleReset}
                        className="flex items-center gap-2 px-6 py-3 bg-primary text-primary-foreground rounded-xl font-bold hover:shadow-lg transition-all active:scale-95"
                    >
                        <RotateCcw className="w-4 h-4" /> Reload System
                    </button>
                    {process.env.NODE_ENV === 'development' && this.state.error && (
                        <pre className="mt-8 p-4 bg-muted rounded-lg text-left text-xs overflow-auto max-w-full text-destructive font-mono border border-destructive/20">
                            {this.state.error.toString()}
                        </pre>
                    )}
                </div>
            );
        }

        return this.props.children;
    }
}

export default GlobalErrorBoundary;
