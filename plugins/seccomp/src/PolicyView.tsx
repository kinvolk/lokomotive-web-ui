import { getSeccompResult, SeccompProfilesApi } from './api';
import { parseSeccompAnnotations } from './helper';
import SeccompPolicyInitialView from './InitialView';
import SeccompPoliciesTableView from './PoliciesTable';
import SeccompPolicyPolicyGatheringView from './PolicyGatheringView';
import SeccompPolicyResultView from './PolicyResultView';

const pluginLib = window.pluginLib;
const { Typography } = pluginLib.MuiCore;
const { SectionBox, Loader } = pluginLib.CommonComponents;
const React = pluginLib.React;
const { useParams } = pluginLib.ReactRouter;
const K8s = pluginLib.K8s.ResourceClasses;
const { useSnackbar } = pluginLib.Notistack;

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
  const [seccompPolicies, setSeccompPolicies] = React.useState(null);
  const [appliedPolicies, setAppliedPolicies] = React.useState(null);
  const [danglingPolicies, setDanglingPolicies] = React.useState(null);
  const [pods] = K8s.Pod.useList();
  const { enqueueSnackbar } = useSnackbar();
  const [currentTracingNamespace, setCurrentTracingNamespace] = React.useState(null);

  function listPolicies() {
    SeccompProfilesApi.list(
      namespace,
      (data: any) => {
        const massagedData = data?.map((item: any) => ({
          ...item,
          pod: pods.find(
            (pod: any) => pod.metadata.name === parseSeccompAnnotations(item, 'pod', namespace)
          ),
        }));
        const filteredData = massagedData.filter(
          (policy: any) =>
            !!policy.pod &&
            !(policy?.status?.activeWorkloads && policy?.status?.activeWorkloads.length !== 0)
        );

        const appliedPolicies = massagedData
          ?.filter((policy: any) => policy?.status?.status !== 'Terminating')
          .filter(
            (policy: any) =>
              policy?.status?.activeWorkloads && policy?.status?.activeWorkloads.length !== 0
          );
        const staledPolicies = massagedData.filter(
          (policy: any) =>
            !policy.pod &&
            !(policy?.status?.activeWorkloads && policy?.status?.activeWorkloads.length !== 0)
        );
        setAppliedPolicies(appliedPolicies);
        setSeccompPolicies(filteredData);
        setDanglingPolicies(staledPolicies);
      },
      (error: any) => {
        enqueueSnackbar(`Error: ${error}`, { preventDuplicate: true });
      }
    );
  }

  React.useEffect(() => {
    if (pods) {
      listPolicies();
    }
  }, [pods]);

  React.useEffect(() => {
    getSeccompResult(data => {
      if (data?.status?.operationError && data?.status?.state === 'Started') {
        enqueueSnackbar(`Error: ${data?.status?.operationError}`, {
          variant: 'error',
          preventDuplicate: true,
        });
        setSeccompStatus(SeccompStatus.SECCOMP_NOT_STARTED);
        return;
      }
      // This means we are viewing a view for which the trace is not running
      setCurrentTracingNamespace(data?.spec?.filter?.namespace);

      // If this annotation is present on custom resource it means inspektor-gadeget didn't process the request
      if (data?.metadata?.annotations['gadget.kinvolk.io/operation']) {
        enqueueSnackbar(`Error: Looks like the gadget pod is not responding to requests`, {
          variant: 'error',
          preventDuplicate: true,
        });
      }
      if (data?.status?.operationError) {
        enqueueSnackbar(`Error: ${data.status.operationError}`, {
          variant: 'error',
          preventDuplicate: true,
        });
        return;
      }
      if (data?.metadata?.annotations?.headlampSeccompTimestamp) {
        setSeccompDefaultTimestamp(data.metadata.annotations.headlampSeccompTimestamp);
        setSeccompStatus(SeccompStatus.SECCOMP_STARTED);
        return;
      } else {
        setSeccompDefaultTimestamp(null);
      }
      // If there is already a timestamp available on CR start from there
      if (data?.metadata?.annotations?.headlampSeccompStartTimestamp) {
        setSeccompStartTimestamp(data.metadata.annotations.headlampSeccompStartTimestamp);
      }
      if (data?.metadata?.annotations?.headlampSeccompFinalTimestamp) {
        setSeccompFinalTimestamp(data.metadata.annotations.headlampSeccompFinalTimestamp);
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
          currentTracingNamespace={currentTracingNamespace}
        />
      );
      break;
    case SeccompStatus.SECCOMP_STOPPED:
      componentToRender = (
        <SeccompPolicyResultView
          startTimestamp={seccompStartTimestamp}
          finalTimestamp={seccompFinalTimestamp}
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
      {seccompPolicies !== null ? (
        <SeccompPoliciesTableView
          seccompPolicies={seccompPolicies}
          appliedPolicies={appliedPolicies}
          danglingPolicies={danglingPolicies}
        />
      ) : (
        <Loader />
      )}
    </SectionBox>
  );
}
