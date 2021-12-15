import { startRecordingSysCalls } from './api';
import playIcon from '@iconify/icons-mdi/play';

const pluginLib = window.pluginLib;
const { Grid, Typography, Button } = pluginLib.MuiCore;
const { useParams } = pluginLib.ReactRouter;
const { Icon } = pluginLib.Iconify;
const React = pluginLib.React;

export default function SeccompPolicyInitialView() {
  const { namespace } = useParams();
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
        <Button variant="outlined" onClick={() => startRecordingSysCalls(namespace)}>
          <Icon icon={playIcon} width="30" height="30" />
          <Typography variant="h6">Start</Typography>
        </Button>
      </Grid>
    </Grid>
  );
}
