import React, { Fragment, useEffect, Suspense, useState, ReactNode, useRef } from 'react';
import { getCachedModule, getAppData, injectScript, processManifest } from '@scalprum/core';
import isEqual from 'lodash/isEqual';
import { loadComponent } from './async-loader';

export type ScalprumComponentProps<API = Record<string, unknown>, Props = Record<string, unknown>> = Props & {
  fallback?: NonNullable<React.ReactNode> | null;
  appName: string;
  api?: API;
  scope: string;
  module: string;
  ErrorComponent?: ReactNode;
  LoadingComponent?: React.ComponentType;
  innerRef?: React.Ref<unknown>;
  processor?: (item: any) => string;
  skipCache?: boolean;
};

const DefaultErrorComponent: React.ComponentType = () => <span>Error while loading component!</span>;

const LoadModule: React.ComponentType<ScalprumComponentProps & { ErrorComponent: React.ComponentType }> = ({
  fallback = 'loading',
  appName,
  scope,
  module,
  ErrorComponent,
  processor,
  innerRef,
  skipCache = false,
  ...props
}) => {
  const { scriptLocation, manifestLocation } = getAppData(appName);
  const [Component, setComponent] = useState<React.ComponentType<{ ref?: React.Ref<unknown> }> | undefined>(undefined);
  const cachedModule = getCachedModule(scope, module, skipCache);
  const isMounted = useRef(true);
  useEffect(() => {
    /**
     * Here will be registry check
     */
    if (!cachedModule) {
      if (scriptLocation) {
        injectScript(appName, scriptLocation)
          .then(() => {
            isMounted.current && setComponent(() => React.lazy(loadComponent(scope, module, ErrorComponent)));
          })
          .catch(() => {
            isMounted.current && setComponent(() => ErrorComponent);
          });
      } else if (manifestLocation) {
        processManifest(manifestLocation, appName, scope, processor)
          .then(() => {
            isMounted.current && setComponent(() => React.lazy(loadComponent(scope, module, ErrorComponent)));
          })
          .catch(() => {
            isMounted.current && setComponent(() => ErrorComponent);
          });
      }
    } else {
      try {
        isMounted.current && setComponent(() => cachedModule.default);
      } catch {
        isMounted.current && setComponent(() => ErrorComponent);
      }
    }

    return () => {
      isMounted.current = false;
    };
  }, [appName, scope, cachedModule, skipCache]);

  return <Suspense fallback={fallback}>{Component ? <Component ref={innerRef} {...props} /> : fallback}</Suspense>;
};

interface BaseScalprumComponentState {
  hasError: boolean;
  error?: any;
  errorInfo?: any;
  repairAttempt?: boolean;
}

class BaseScalprumComponent extends React.Component<ScalprumComponentProps, BaseScalprumComponentState> {
  selfRepairAttempt: boolean;
  static defaultProps = {
    ErrorComponent: <DefaultErrorComponent />,
  };
  constructor(props: ScalprumComponentProps) {
    super(props);
    this.state = { hasError: false };
    this.selfRepairAttempt = false;
  }

  static getDerivedStateFromError(): BaseScalprumComponentState {
    return { hasError: true };
  }

  shouldComponentUpdate(nextProps: ScalprumComponentProps, nextState: BaseScalprumComponentState) {
    if (this.state.hasError !== nextState.hasError) {
      return true;
    }

    return !isEqual(nextProps, this.props) || !isEqual(nextState, this.state);
  }

  componentDidCatch(error: Error, errorInfo: React.ErrorInfo) {
    if (this.selfRepairAttempt === true) {
      console.error('Scalprum encountered an error!', error.message);
      this.setState({ error, errorInfo });
    } else {
      console.warn('Scalprum failed to render component. Attempting to skip module cache.');
      this.setState({ repairAttempt: true });
    }
  }

  render(): ReactNode {
    const { ErrorComponent = <DefaultErrorComponent />, ...props } = this.props;

    if (this.state.repairAttempt && !this.selfRepairAttempt) {
      /**
       * Retry fetching module with disabled cache
       */
      this.selfRepairAttempt = true;
      return <LoadModule {...props} skipCache ErrorComponent={() => <Fragment>{ErrorComponent}</Fragment>} />;
    }

    if (this.state.hasError && this.selfRepairAttempt) {
      return React.cloneElement(ErrorComponent as React.FunctionComponentElement<BaseScalprumComponentState>, { ...this.state });
    }

    return <LoadModule {...props} ErrorComponent={() => <Fragment>{ErrorComponent}</Fragment>} />;
  }
}

export const ScalprumComponent: React.ComponentType<ScalprumComponentProps> = React.forwardRef((props, ref) => (
  <BaseScalprumComponent {...props} innerRef={ref} />
));
