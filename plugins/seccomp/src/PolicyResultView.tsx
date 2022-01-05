import { startRecordingSysCalls } from './api';
import restartIcon from '@iconify/icons-mdi/restart';

const pluginLib = window.pluginLib;
const { Grid, Button, Typography, Box } = pluginLib.MuiCore;
const React = pluginLib.React;
const { useParams } = pluginLib.ReactRouter;
const { Icon } = pluginLib.Iconify;

export default function SeccompPolicyResultView(props: any) {
  const { startTimestamp, finalTimestamp } = props;
  const { namespace } = useParams();

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
          <Button
            variant="outlined"
            onClick={() => {
              startRecordingSysCalls(namespace);
            }}
          >
            <Icon icon={restartIcon} width="30" height="30" />
            <Typography variant="h6">Restart</Typography>
          </Button>
        </Grid>
      </Grid>
    </Box>
  );
}
