import React, { Component, ErrorInfo, ReactNode } from "react";

interface Props {
  children?: ReactNode;
}

interface State {
  hasError: boolean;
  error: Error | null;
}

export class ErrorBoundary extends Component<Props, State> {
  constructor(props: Props) {
    super(props);
    this.state = {
      hasError: false,
      error: null
    };
  }

  public static getDerivedStateFromError(error: Error): State {
    return { hasError: true, error };
  }

  public componentDidCatch(error: Error, errorInfo: ErrorInfo) {
    console.error("Uncaught error:", error, errorInfo);
  }

  public render() {
    if (this.state.hasError) {
      return (
        <div className="p-10 flex flex-col items-center justify-center text-red-500 bg-red-50 rounded-xl m-8">
          <h1 className="text-2xl font-bold">Crash detected!</h1>
          <p className="mt-2 text-sm">{this.state.error?.toString()}</p>
          <button onClick={() => this.setState({hasError: false, error: null})} className="mt-4 px-4 py-2 bg-slate-900 text-white rounded font-bold">Retry</button>
        </div>
      );
    }
    return this.props.children;
  }
}

