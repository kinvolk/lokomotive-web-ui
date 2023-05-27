import { addTimestamp, generateSeccompProfile, stopSysCallGathering } from './api';
import Timer from './Timer';
import stopIcon from '@iconify/icons-mdi/stop';

const pluginLib = window.pluginLib;
const { Grid, Typography, Button, Box } = pluginLib.MuiCore;
const { Loader } = pluginLib.CommonComponents;
const React = pluginLib.React;
const { useParams } = pluginLib.ReactRouter;
const { Icon } = pluginLib.Iconify;
const K8s = pluginLib.K8s.ResourceClasses;

export default function SeccompPolicyPolicyGatheringView(props: any) {
  const { namespace } = useParams();
  const { timestamp, currentTracingNamespace } = props;
  const [isGatheringPolicies, setIsGatheringPolicies] = React.useState(false);
  const [pods, error] = K8s.Pod.useList();
  console.log(error);

  function stopSysCallGatheringHandler() {
    // before we stop sysCallGathering we need to generate seccomp profiles
    setIsGatheringPolicies(true);
    generateSeccompProfile(namespace, pods)
      .then(() => {
        stopSysCallGathering().then((response: any) => {
          console.log("stop response")
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
          <Typography variant="h6">Gathering policies on namespace {currentTracingNamespace} for</Typography>
        </Grid>
        <Grid item>
          <Timer sysCallCheckTimestamp={timestamp} />
        </Grid>
        <Grid item>
          <Loader title="gathering sys call loader" color={'inherit'} />
        </Grid>
        <Grid item>
          <Button
            variant="outlined"
            onClick={() => {
              stopSysCallGatheringHandler()
            }}
            disabled={isGatheringPolicies}
          >
            <Icon icon={stopIcon} width="40" height="40" />
            <Typography variant="h6">{isGatheringPolicies ? 'Generating' : 'Stop'}</Typography>
          </Button>
        </Grid>
      </Grid>
    </Box>
  );
}
