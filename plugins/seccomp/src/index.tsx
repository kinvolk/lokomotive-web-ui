import playIcon from '@iconify/icons-mdi/play';
import stopIcon from '@iconify/icons-mdi/stop';
import restartIcon from '@iconify/icons-mdi/restart';
import checkIcon from '@iconify/icons-mdi/check';
import Registry from '@kinvolk/headlamp-plugin/types/plugin/registry.d';
const pluginLib = window.pluginLib;
const { Link, SectionFilterHeader, SectionBox, SimpleTable, Loader, EditorDialog, ConfirmDialog } =
  pluginLib.CommonComponents;
const React = pluginLib.React;
const { useParams } = pluginLib.ReactRouter;
const K8s = pluginLib.K8s.ResourceClasses;
const { Grid, Button, Typography, Box, Checkbox } = pluginLib.MuiCore;
const { Icon } = pluginLib.Iconify;
const { ApiProxy } = pluginLib;
const ResourceAPI = new K8s.CustomResource('gadget.kinvolk.io', 'v1alpha1', 'traces');

function startRecordingSysCalls() {
  return ResourceAPI.patch(
    [
      { op: 'add', path: '/metadata/annotations/gadget.kinvolk.io~1operation', value: 'start' },
      {
        op: 'add',
        path: '/metadata/annotations/headlampSeccompStartTimestamp',
        value: new Date().getTime().toString(),
      },
    ],
    'gadget',
    'seccomp'
  );
}

function stopSysCallGathering() {
  return ResourceAPI.patch(
    [
      { op: 'add', path: '/metadata/annotations/gadget.kinvolk.io~1operation', value: 'stop' },
      { op: 'remove', path: '/metadata/annotations/headlampSeccompTimestamp' },
    ],
    'gadget',
    'seccomp'
  );
}

function generateSeccompProfile() {
  return ResourceAPI.patch(
    [{ op: 'add', path: '/metadata/annotations/gadget.kinvolk.io~1operation', value: 'stop' }],
    'gadget',
    'seccomp'
  );
}

function getSeccompResult(cb: (data: any) => void) {
  return ResourceAPI.apiEndpoint.get('gadget', 'seccomp', function (data: any) {
    cb(data);
  });
}

function addTimestamp(timestamp?: string, timestampName?: string) {
  return ResourceAPI.patch(
    [
      {
        op: 'add',
        path: `/metadata/annotations/${timestampName || 'headlampSeccompTimestamp'}`,
        value: timestamp || new Date().getTime().toString(),
      },
    ],
    'gadget',
    'seccomp'
  );
}

function updateSeccompPolicy(body: any) {
  return ApiProxy.apiFactoryWithNamespace(
    'security-profiles-operator.x-k8s.io',
    'v1alpha1',
    'seccompprofiles'
  ).put(body);
}

enum SeccompStatus {
  SECCOMP_NOT_STARTED = -1,
  SECCOMP_STOPPED,
  SECCOMP_STARTED,
}

function Timer(props: any) {
  const [timePassed, setTimePassed] = React.useState(null);
  const { sysCallCheckTimestamp } = props;
  const [countDownHandlerID, setCountDownHandlerID] = React.useState(null);

  React.useEffect(() => {
    const countDownDate = new Date().getTime();
    addTimestamp();
    // Update the count down every 1 second
    const countDownHandler = setInterval(function () {
      const now = new Date().getTime();
      let difference: number;
      if (sysCallCheckTimestamp) {
        difference = now - parseInt(sysCallCheckTimestamp);
      } else {
        // Get today's date and time
        difference = now - countDownDate;
      }
      // Time calculations for days, hours, minutes and seconds
      const hours = Math.floor((difference % (1000 * 60 * 60 * 24)) / (1000 * 60 * 60));
      const minutes = Math.floor((difference % (1000 * 60 * 60)) / (1000 * 60));
      const seconds = Math.floor((difference % (1000 * 60)) / 1000);
      setTimePassed(`${hours}h${minutes}m${seconds}s`);
    }, 1000);
    setCountDownHandlerID(countDownHandler);
    //prevent memory leak
    return () => {
      clearInterval(countDownHandler);
    };
  }, []);
  return <Typography variant="h6">{timePassed}</Typography>;
}

function SeccompPolicyInitialView() {
  return (
    <Grid
      container
      direction="column"
      justifyContent="center"
      alignItems="center"
      style={{ height: '400px' }}
      spacing="2"
    >
      <Grid item>
        <Typography variant="h6">Press start to start gathering the seccomp policies</Typography>
      </Grid>
      <Grid item>
        <Button variant="outlined" onClick={startRecordingSysCalls}>
          <Icon icon={playIcon} width="30" height="30" />
          <Typography variant="h6">Start</Typography>
        </Button>
      </Grid>
    </Grid>
  );
}

function SeccompPolicyPolicyGatheringView(props: any) {
  const { namespace } = useParams();
  const { timestamp, seccompPolicies } = props;
  const [isGatheringPolicies, setIsGatheringPolicies] = React.useState(false);
  function stopSysCallGatheringHandler() {
    // before we stop sysCallGathering we need to generate seccomp profiles
    setIsGatheringPolicies(true);
    generateSeccompProfile()
      .then(() => {
        stopSysCallGathering().then(() => {
          setIsGatheringPolicies(false);
          addTimestamp(new Date().getTime().toString(), 'headlampSeccompFinalTimestamp');
        });
      })
      .catch(() => {
        setIsGatheringPolicies(false);
      });
  }

  return (
    <Box>
      <Grid container justifyContent="center" alignItems="center" spacing={2}>
        <Grid item>
          <Typography variant="h6">Gathering policies on namespace {namespace} for</Typography>
        </Grid>
        <Grid item>
          <Timer sysCallCheckTimestamp={timestamp} />
        </Grid>
        <Grid item>
          <Loader title="gathering sys call loader" color={'inherit'} />
        </Grid>
        <Grid item>
          <Button variant="outlined" onClick={stopSysCallGatheringHandler}>
            <Icon icon={stopIcon} width="40" height="40" />
            <Typography variant="h6">{isGatheringPolicies ? 'Generating' : 'Stop'}</Typography>
          </Button>
        </Grid>
      </Grid>
      <SeccompPoliciesTableView seccompPolicies={seccompPolicies} />
    </Box>
  );
}

function SeccompPolicyResultView(props: any) {
  const { startTimestamp, finalTimestamp, seccompPolicies } = props;

  return (
    <Box pt={2}>
      <Grid container spacing={2} justifyContent="center">
        <Grid item>
          {startTimestamp && finalTimestamp && (
            <Typography variant="h6">
              Policies Gathered from{' '}
              {`${new Date(parseInt(startTimestamp)).toLocaleString()} to ${new Date(
                parseInt(finalTimestamp)
              ).toLocaleString()}`}
            </Typography>
          )}
        </Grid>
        <Grid item>
          <Button variant="outlined" onClick={startRecordingSysCalls}>
            <Icon icon={restartIcon} width="30" height="30" />
            <Typography variant="h6">Restart</Typography>
          </Button>
        </Grid>
      </Grid>
      <SeccompPoliciesTableView seccompPolicies={seccompPolicies} />
    </Box>
  );
}

enum POSSIBLE_WORKLOADS {
  POD = 'Pod',
  DEPLOYMENT = 'Deployment',
  DAEMONSET = 'DaemonSet',
  STATEFULSET = 'StatefulSet',
  REPLICASET = 'ReplicaSet',
  JOBS = 'JOBS',
  CRONJOB = 'CronJob',
}

function getGroupAndVersion(kind = 'Pod') {
  switch (kind) {
    case POSSIBLE_WORKLOADS.POD:
      return ['', 'v1'];
    case POSSIBLE_WORKLOADS.DEPLOYMENT:
    case POSSIBLE_WORKLOADS.DAEMONSET:
    case POSSIBLE_WORKLOADS.REPLICASET:
    case POSSIBLE_WORKLOADS.STATEFULSET:
      return ['apps', 'v1'];
    case POSSIBLE_WORKLOADS.JOBS:
      return ['batch', 'v1'];
    case POSSIBLE_WORKLOADS.CRONJOB:
      return ['batch', 'v1beta1'];
  }
  return ['', 'v1'];
}

function getOwnerReference(
  name: string,
  namespace: string,
  kind = 'Pod'
): Promise<
  [
    {
      kind: string;
      name: string;
    }
  ]
> {
  const [group, version] = getGroupAndVersion(kind);
  return new Promise((resolve, reject) => {
    ApiProxy.apiFactoryWithNamespace(group, version, kind.toLowerCase() + 's')
      .get(namespace, name, (data: any) => {
        resolve(data?.metadata?.ownerReferences);
      })
      .catch((error: Error) => {
        reject(error);
      });
  });
}

async function FindRootWorkload(podName: string, namespace: string, kind = 'Pod'): Promise<string> {
  try {
    const ownerReferences: Array<{
      kind: string;
      name: string;
    }> = await getOwnerReference(podName, namespace, kind);
    console.log(ownerReferences, kind);
    if (!ownerReferences) {
      console.log('here', kind);
      // this means the current kind property set is the root parent workload
      return kind;
    } else {
      if (!Object.keys(POSSIBLE_WORKLOADS).includes(ownerReferences[0].kind)) {
        return kind;
      }
      return FindRootWorkload(ownerReferences[0].name, namespace, ownerReferences[0].kind);
    }
  } catch (error) {
    throw new Error(`Error getting the root parent workload`);
  }
}

FindRootWorkload('etcd-minikube', 'kube-system').then((response: any) => {
  console.log(response);
});
function SeccompPoliciesTableView(props: any) {
  const { seccompPolicies } = props;
  const [isEditorOpen, setIsEditorOpen] = React.useState(false);
  const [editorValue, setEditorValue] = React.useState(null);
  const [errorMessage, setErrorMessage] = React.useState(null);
  const [selectedPolicies, setSelectedPolicies] = React.useState([]);
  const [isConfirmDialogOpen, setIsConfirmDialogOpen] = React.useState(false);
  console.log(seccompPolicies);
  function handleSave(value: any) {
    console.log(value);
    updateSeccompPolicy(value)
      .then(() => {
        setIsEditorOpen(false);
      })
      .catch((err: Error) => {
        setErrorMessage(err.message);
      });
  }

  function handleCheckBox(e: any) {
    const policies = [...selectedPolicies];
    if (e.target.checked) {
      policies.push(e.target.value);
    } else {
      policies.splice(policies.indexOf(e.target.value), 1);
    }
    setSelectedPolicies(policies);
  }

  function handlePolicyApply() {
    setIsConfirmDialogOpen(true);
  }

  function handlePolicyMerge() {
    setIsConfirmDialogOpen(true);
  }

  function generateDialogDescription() {
    return `These seccomp policies were generated for pods <Dummy_POD> which belongs to workflow
    <Dummy_Workflow>.
    Do you want to patch these workflows to use these policies?
    Warning: This will restart the pods`;
  }

  function handleConfirm() {
    console.log('handle confirmation here');
  }

  return (
    <>
      <ConfirmDialog
        open={isConfirmDialogOpen}
        description={generateDialogDescription()}
        onConfirm={handleConfirm}
        handleClose={() => setIsConfirmDialogOpen(false)}
      />
      {selectedPolicies.length > 0 && (
        <Grid container spacing={2}>
          <Grid item>
            <Button variant="outlined" onClick={handlePolicyApply}>
              <Icon icon={checkIcon} width="20" height="20" />
              <Typography>Apply</Typography>
            </Button>
          </Grid>
          <Grid item>
            <Button variant="outlined" onClick={handlePolicyMerge}>
              <Typography>Merge</Typography>
            </Button>
          </Grid>
        </Grid>
      )}
      <SimpleTable
        columns={[
          {
            getter: (data: any) => <Checkbox value={data.metadata.uid} onChange={handleCheckBox} />,
          },
          {
            label: 'Policy',
            getter: (data: any) => (
              <Link
                onClick={() => {
                  setIsEditorOpen(true);
                  setEditorValue(data);
                }}
              >
                {data.metadata.name}
              </Link>
            ),
          },
          {
            label: 'Pod',
            getter: () => 'Some_DummY_POD',
          },
          {
            label: 'Container',
            getter: () => 'Some_Dummy_Container',
          },
          {
            label: 'Date',
            getter: (data: any) => new Date(data.metadata.creationTimestamp).toLocaleString(),
          },
        ]}
        data={seccompPolicies}
      />
      {editorValue && (
        <EditorDialog
          item={editorValue}
          open={isEditorOpen}
          onClose={() => setIsEditorOpen(false)}
          onSave={handleSave}
          onEditorChanged={(value: any) => {
            setEditorValue(value);
            setErrorMessage(null);
          }}
          errorMessage={errorMessage}
        />
      )}
    </>
  );
}

function SeccompPolicyView() {
  const { namespace } = useParams();
  const [seccompStatus, setSeccompStatus] = React.useState(SeccompStatus.SECCOMP_NOT_STARTED);
  const [seccompDefaultTimestamp, setSeccompDefaultTimestamp] = React.useState(null);
  const [seccompFinalTimestamp, setSeccompFinalTimestamp] = React.useState(null);
  const [seccompStartTimestamp, setSeccompStartTimestamp] = React.useState(null);
  const [operationError, setOperationError] = React.useState(null);
  const [seccompPolicies, setSeccompPolicies] = React.useState(null);

  React.useEffect(() => {
    ApiProxy.apiFactoryWithNamespace(
      'security-profiles-operator.x-k8s.io',
      'v1alpha1',
      'seccompprofiles'
    ).list(namespace, (data: any) => {
      setSeccompPolicies(data);
    });
  }, []);

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

function SeccompPolicyList() {
  const [seccompData, setSeccompData] = React.useState(null);
  React.useEffect(() => {
    ApiProxy.apiFactory('security-profiles-operator.x-k8s.io', 'v1alpha1', 'seccompprofiles').list(
      (data: any) => {
        let massagedData: any = [];
        data.forEach((item: any) => {
          const elementFound = massagedData.find(
            (element: any) => element.namespace === item.metadata.namespace
          );
          if (elementFound) {
            elementFound.policyCount++;
          } else {
            massagedData.push({ namespace: item.metadata.namespace, policyCount: 1 });
          }
        });
        setSeccompData(massagedData);
      }
    );
  }, []);
  return (
    <SectionBox
      title={
        <SectionFilterHeader title={'Seccomp Profiles'} noNamespaceFilter headerStyle="main" />
      }
    >
      <SimpleTable
        rowsPerPage={[15, 25, 50]}
        columns={[
          {
            label: 'Namespace',
            getter: (data: any) => (
              <Link routeName="/seccomppolicies/:namespace" params={{ namespace: data.namespace }}>
                {data.namespace}
              </Link>
            ),
            sort: (d1: any, d2: any) => {
              if (d1.namespace < d2.namespace) {
                return -1;
              } else if (d1.namespace > d2.namespace) {
                return 1;
              }
              return 0;
            },
          },
          {
            label: 'Num. Policies',
            getter: (data: any) => data.policyCount,
          },
        ]}
        data={seccompData}
        defaultSortingColumn={3}
      />
    </SectionBox>
  );
}

class MyPlugin {
  initialize(register: Registry) {
    register.registerSidebarItem(
      'security',
      'seccomppolicies',
      'Seccomp Policies',
      '/seccomppolicies'
    );
    register.registerRoute({
      path: '/seccomppolicies',
      sidebar: 'seccomppolicies',
      component: () => <SeccompPolicyList />,
      exact: true,
    });
    register.registerRoute({
      path: '/seccomppolicies/:namespace',
      component: () => <SeccompPolicyView />,
      sidebar: 'seccomppolicies',
      exact: true,
    });
    return true;
  }
}

window.registerPlugin('headlamp-seccomp', new MyPlugin());
