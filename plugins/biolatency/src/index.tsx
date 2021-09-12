import Registry from '@kinvolk/headlamp-plugin/types/plugin/registry.d';
import playCircleOutline from '@iconify/icons-mdi/play-circle-outline';
import stopIcon from '@iconify/icons-mdi/stop';
import restartIcon from '@iconify/icons-mdi/restart';
const pluginLib = window.pluginLib;
const { Loader, NameLabel } = window.pluginLib.CommonComponents;
const React = window.pluginLib.React;
const { BarChart, XAxis, YAxis, Tooltip, Legend, Bar } = window.pluginLib.Recharts;
const K8s = pluginLib.K8s.ResourceClasses;
const { Grid, Box, IconButton, Typography, Button } = pluginLib.MuiCore;
const { Icon } = pluginLib.Iconify;
const TRACES_RESOURCE_GROUP = 'gadget.kinvolk.io';
const IG_TRACE_NAMESPACE = 'gadget';
const TRACE_BIOLATENCY_RESOURCE_NAME = 'biolatency';
const ResourceAPI = new K8s.CustomResource(TRACES_RESOURCE_GROUP, 'v1alpha1', 'traces');

function startLatencyCheck() {
  return ResourceAPI.patch(
    [
      { op: 'add', path: '/metadata/annotations/gadget.kinvolk.io~1operation', value: 'start' },
      {
        op: 'add',
        path: '/metadata/annotations/headlampStartTimestamp',
        value: new Date().getTime().toString(),
      },
    ],
    IG_TRACE_NAMESPACE,
    TRACE_BIOLATENCY_RESOURCE_NAME
  );
}

function addTimestamp(timestamp?: string, timestampName?: string) {
  return ResourceAPI.patch(
    [
      {
        op: 'add',
        path: `/metadata/annotations/${timestampName || 'headlampTimestamp'}`,
        value: timestamp || new Date().getTime().toString(),
      },
    ],
    IG_TRACE_NAMESPACE,
    TRACE_BIOLATENCY_RESOURCE_NAME
  );
}

function stopLatencyCheck() {
  return ResourceAPI.patch(
    [
      { op: 'add', path: '/metadata/annotations/gadget.kinvolk.io~1operation', value: 'stop' },
      { op: 'remove', path: '/metadata/annotations/headlampTimestamp' },
    ],
    IG_TRACE_NAMESPACE,
    TRACE_BIOLATENCY_RESOURCE_NAME
  );
}

function getLatencyResult(cb: (data: any) => void) {
  return ResourceAPI.apiEndpoint.get(
    IG_TRACE_NAMESPACE,
    TRACE_BIOLATENCY_RESOURCE_NAME,
    function (data: any) {
      cb(data);
    }
  );
}

enum LatencyCheckStatus {
  LATENCY_CHECK_NOT_STARTED = -1,
  LATENCY_CHECK_STOPPED,
  LATENCY_CHECK_STARTED,
}

function CustomComponent() {
  const [outputString, setOutputString] = React.useState('');
  const [outputError, setOutputError] = React.useState(null);
  const [latencyCheckTimestamp, setLatencyCheckTimestamp] = React.useState(null);
  const [finalTimestamp, setFinalTimestamp] = React.useState(null);
  const [startTimestamp, setStartTimestamp] = React.useState(null);
  const [latencyCheckStatus, setLatencyCheckStatus] = React.useState(
    LatencyCheckStatus.LATENCY_CHECK_NOT_STARTED
  );

  React.useEffect(() => {
    getLatencyResult((response: any) => {
      if (response?.metadata?.annotations?.headlampFinalTimestamp) {
        setFinalTimestamp(parseInt(response.metadata.annotations.headlampFinalTimestamp));
      }
      if (response?.metadata?.annotations?.headlampStartTimestamp) {
        setStartTimestamp(parseInt(response.metadata.annotations.headlampStartTimestamp));
      }
      if (response?.metadata?.annotations?.headlampTimestamp) {
        setLatencyCheckTimestamp(response.metadata.annotations.headlampTimestamp);
        setLatencyCheckStatus(LatencyCheckStatus.LATENCY_CHECK_STARTED);
        return;
      } else {
        setLatencyCheckTimestamp(null);
      }
      if (response?.status?.operationError) {
        setOutputError(response.status.operationError);
        setLatencyCheckStatus(LatencyCheckStatus.LATENCY_CHECK_STOPPED);
        return;
      }
      if (response?.status?.state === 'Completed') {
        setOutputString(response.status.output);
        setLatencyCheckStatus(LatencyCheckStatus.LATENCY_CHECK_STOPPED);
        return;
      }
      if (response.status.state === 'Started') {
        if (latencyCheckStatus !== LatencyCheckStatus.LATENCY_CHECK_STARTED) {
          setLatencyCheckStatus(LatencyCheckStatus.LATENCY_CHECK_STARTED);
        }
      }
    });
  }, []);
  let componentToRender = (
    <LatencyCheckInitial
      setLatencyCheckStatus={() => {
        setLatencyCheckStatus(LatencyCheckStatus.LATENCY_CHECK_STARTED);
        startLatencyCheck().catch((error: Error) => {
          setOutputError(error.message);
        });
      }}
    />
  );

  switch (latencyCheckStatus) {
    case LatencyCheckStatus.LATENCY_CHECK_STOPPED:
      componentToRender = (
        <LatencyCharts
          outputString={outputString}
          setLatencyCheckStatus={() => {
            startLatencyCheck().catch((error: Error) => {
              setOutputError(error.message);
            });
            setLatencyCheckStatus(LatencyCheckStatus.LATENCY_CHECK_STARTED);
          }}
          outputError={outputError}
          finalTimestamp={finalTimestamp}
          startTimestamp={startTimestamp}
        />
      );
      break;
    case LatencyCheckStatus.LATENCY_CHECK_STARTED:
      componentToRender = (
        <TimerComponent
          setOutputString={setOutputString}
          setOutputError={setOutputError}
          latencyCheckTimestamp={latencyCheckTimestamp}
        />
      );
      break;
    default:
      componentToRender = (
        <LatencyCheckInitial
          setLatencyCheckStatus={() => {
            setLatencyCheckStatus(LatencyCheckStatus.LATENCY_CHECK_STARTED);
            startLatencyCheck().catch((error: Error) => {
              setOutputError(error.message);
            });
          }}
        />
      );
  }
  return <Box>{componentToRender}</Box>;
}

function LatencyCharts(props: any) {
  const { outputString, setLatencyCheckStatus, outputError, finalTimestamp, startTimestamp } =
    props;
  const [chartData, setChartData] = React.useState(null);
  function prepareChartData(outputString: string) {
    /*
    sample output string
    "Tracing block device I/O... Hit Ctrl-C to end.\n\n
    usecs               : count     distribution\n
    0 -> 1          : 0        |                                        |\n
    2 -> 3          : 0        |                                        |\n
     4 -> 7          : 0        |                                        |\n"
    parse the output string and extract data such that we get the example form
    {usecs: "1-2", count: 10}
    */
    const chartData = outputString.split('\n');
    const data = [];
    for (let i = 3; i < chartData.length; i++) {
      const dataChild = chartData[i].split(/[:|/|]/);
      if (dataChild[0] && dataChild[1] && dataChild[2]) {
        const usecs = dataChild[0].trim().replace('->', '-');
        data.push({
          usecs: usecs,
          count: parseInt(dataChild[1].trim()),
        });
      }
    }
    setChartData([...data]);
  }

  React.useEffect(() => {
    if (!outputString) {
      return;
    }
    prepareChartData(outputString);
  }, [outputString]);

  return (
    <Box py={2}>
      <Grid container direction="column" justify="center" alignItems="center" spacing={2}>
        <Grid item>
          <Typography variant="h6">
            Press restart to start recording the latency data again
          </Typography>
        </Grid>
        <Grid item>
          <Button variant="outlined" onClick={setLatencyCheckStatus}>
            <Icon icon={restartIcon} width="30" height="30" />
            <Typography variant="h6">Restart</Typography>
          </Button>
        </Grid>
        {chartData ? (
          <>
            <Grid item>
              <BarChart width={730} height={250} data={chartData}>
                <XAxis dataKey="usecs" />
                <YAxis />
                <Tooltip />
                <Legend />
                <Bar dataKey="count" fill="#000" name="I/O count" />
              </BarChart>
            </Grid>
            <Grid item>
              {startTimestamp && finalTimestamp && (
                <NameLabel>
                  Data recorded from{' '}
                  {`${new Date(startTimestamp).toLocaleString()} - ${new Date(
                    finalTimestamp
                  ).toLocaleString()}`}
                </NameLabel>
              )}
            </Grid>
          </>
        ) : (
          outputError && (
            <Grid item>
              <Box color="red" fontSize={20}>
                Something Went Wrong
              </Box>
              <Box color="red">{outputError}</Box>
            </Grid>
          )
        )}
      </Grid>
    </Box>
  );
}

function LatencyCheckInitial(props: any) {
  const { setLatencyCheckStatus } = props;
  return (
    <Box py={2}>
      <Grid container direction="column" justify="center" alignItems="center" spacing={2}>
        <Grid item>
          <Typography variant="h6">
            Start recording the block I/O latency data and then stop at any time to see the results
          </Typography>
        </Grid>
        <Grid item>
          <IconButton onClick={setLatencyCheckStatus}>
            <Icon icon={playCircleOutline} width="80" height="80" />
          </IconButton>
        </Grid>
      </Grid>
    </Box>
  );
}

function TimerComponent(props: any) {
  const [timePassed, setTimePassed] = React.useState(null);
  const [changeStopButtonText, setChangeStopButtonText] = React.useState(false);
  const { setOutputError, latencyCheckTimestamp } = props;
  const [countDownHandlerID, setCountDownHandlerID] = React.useState(null);

  function stopLatencyCheckHandler() {
    setChangeStopButtonText(true);
    function latencyCheckFunc() {
      stopLatencyCheck()
        .then(() => {
          setChangeStopButtonText(false);
          clearInterval(countDownHandlerID);
          addTimestamp(new Date().getTime().toString(), 'headlampFinalTimestamp');
        })
        .catch((error: Error) => {
          setOutputError(error.message);
          clearInterval(countDownHandlerID);
        });
    }
    latencyCheckFunc();
  }

  React.useEffect(() => {
    const countDownDate = new Date().getTime();
    // Update the count down every 1 second
    addTimestamp();
    const countDownHandler = setInterval(function () {
      const now = new Date().getTime();
      let difference: number;
      if (latencyCheckTimestamp) {
        difference = now - parseInt(latencyCheckTimestamp);
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

  return (
    <Box py={2}>
      <Grid container direction="column" justify="center" alignItems="center" spacing={2}>
        <Grid item>
          <Typography variant="h6">{`Gathering data for ${timePassed || '…'}`}</Typography>
          <Loader title="latency check loader" color={'inherit'} />
        </Grid>
        <Grid item>
          <Typography variant="h6">Press stop to see the results.</Typography>
        </Grid>
        <Grid item>
          <Button variant="outlined" onClick={stopLatencyCheckHandler}>
            <Icon icon={stopIcon} width="40" height="40" />
            <Typography variant="h6">Stop{changeStopButtonText && `ping...`}</Typography>
          </Button>
        </Grid>
      </Grid>
    </Box>
  );
}

class MyPlugin {
  initialize(register: Registry) {
    register.registerDetailsViewSection('biolatency', resource => {
      if (resource?.kind === 'Node') {
        return {
          title: 'Block I/O Latency',
          component: () => <CustomComponent />,
        };
      }
      return null;
    });
    return true;
  }
}

window.registerPlugin('headlamp-myfancy', new MyPlugin());
