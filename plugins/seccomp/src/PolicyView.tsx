import { getSeccompResult, SeccompProfilesApi } from './api';
import { checkIfPolicyNotApplied, parseSeccompAnnotations } from './helper';
import SeccompPolicyInitialView from './InitialView';
import SeccompPolicyPolicyGatheringView from './PolicyGatheringView';
import SeccompPolicyResultView from './PolicyResultView';

const pluginLib = window.pluginLib;
const { Typography } = pluginLib.MuiCore;
const { SectionBox } = pluginLib.CommonComponents;
const React = pluginLib.React;
const { useParams } = pluginLib.ReactRouter;
const K8s = pluginLib.K8s.ResourceClasses;

enum SeccompStatus {
  SECCOMP_NOT_STARTED = -1,
  SECCOMP_STOPPED,
  SECCOMP_STARTED,
}

export default function SeccompPolicyView() {
  const { namespace } = useParams();
  const [seccompStatus, setSeccompStatus] = React.useState(SeccompStatus.SECCOMP_NOT_STARTED);
  const [seccompDefaultTimestamp, setSeccompDefaultTimestamp] = React.useState(null);
  const [seccompFinalTimestamp, setSeccompFinalTimestamp] = React.useState(null);
  const [seccompStartTimestamp, setSeccompStartTimestamp] = React.useState(null);
  const [operationError, setOperationError] = React.useState(null);
  const [seccompPolicies, setSeccompPolicies] = React.useState(null);
  const [appliedPolicies, setAppliedPolicies] = React.useState(null);
  const [pods, error] = K8s.Pod.useList();
  console.log(error);
  React.useEffect(() => {
    if (pods) {
      SeccompProfilesApi.list(
        namespace,
        (data: any) => {
          // don't consider policies that are in terminating state
          const massagedData = data
            ?.filter((policy: any) => policy?.status?.status !== 'Terminating')
            .map((item: any) => ({
              ...item,
              pod: pods.find(
                (pod: any) => pod.metadata.name === parseSeccompAnnotations(item, 'pod', namespace)
              ),
            }));
          const filteredData = massagedData.filter(
            (policy: any) =>
              !!policy.pod && !(policy?.status?.activeWorkloads && policy?.status?.activeWorkloads.length !== 0)
          );
          const appliedPolicies = data
            ?.filter((policy: any) => policy?.status?.status !== 'Terminating')
            .filter(
              (policy: any) =>
                policy?.status?.activeWorkloads && policy?.status?.activeWorkloads.length !== 0
            );
          setAppliedPolicies(appliedPolicies);
          setSeccompPolicies(filteredData);
        },
        (error: any) => {
          console.log(error);
        }
      );
    }
  }, [pods]);

  React.useEffect(() => {
    getSeccompResult(data => {
      if (data?.metadata?.annotations?.headlampSeccompTimestamp) {
        setSeccompDefaultTimestamp(data.metadata.annotations.headlampSeccompTimestamp);
        setSeccompStatus(SeccompStatus.SECCOMP_STARTED);
        return;
      } else {
        setSeccompDefaultTimestamp(null);
      }
      if (data?.metadata?.annotations?.headlampSeccompStartTimestamp) {
        setSeccompStartTimestamp(data.metadata.annotations.headlampSeccompStartTimestamp);
      }
      if (data?.metadata?.annotations?.headlampSeccompFinalTimestamp) {
        setSeccompFinalTimestamp(data.metadata.annotations.headlampSeccompFinalTimestamp);
      }
      if (data?.status?.operationError) {
        setOperationError(data.status.operationError);
        return;
      }
      if (data?.status?.state === 'Started') {
        setSeccompStatus(SeccompStatus.SECCOMP_STARTED);
      }
      if (data?.status?.state === 'Stopped') {
        setSeccompStatus(SeccompStatus.SECCOMP_STOPPED);
      }
    });
  }, []);
  let componentToRender = <SeccompPolicyInitialView />;
  switch (seccompStatus) {
    case SeccompStatus.SECCOMP_STARTED:
      componentToRender = (
        <SeccompPolicyPolicyGatheringView
          timestamp={seccompDefaultTimestamp}
          seccompPolicies={seccompPolicies}
          appliedPolicies={appliedPolicies}
        />
      );
      break;
    case SeccompStatus.SECCOMP_STOPPED:
      componentToRender = (
        <SeccompPolicyResultView
          startTimestamp={seccompStartTimestamp}
          finalTimestamp={seccompFinalTimestamp}
          operationError={operationError}
          seccompPolicies={seccompPolicies}
          appliedPolicies={appliedPolicies}
        />
      );
      break;
    default:
      componentToRender = <SeccompPolicyInitialView />;
  }

  return (
    <SectionBox
      title={
        <Typography variant="h4" style={{ textAlign: 'center', padding: '1rem' }}>
          Seccomp Policies for namespace: {namespace}
        </Typography>
      }
    >
      {componentToRender}
    </SectionBox>
  );
}
