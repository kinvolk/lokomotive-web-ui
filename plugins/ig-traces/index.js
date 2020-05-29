import tracesIcon from '@iconify/icons-mdi/file-document-box-search-outline';
import { Icon } from '@iconify/react';
import _ from 'lodash';

const React = window.pluginLib.React;
const { timeAgo } = window.pluginLib.Utils;
const {
  SimpleTable,
  SectionBox,
  SectionFilterHeader,
  LogViewer,
  StatusLabel,
} = window.pluginLib.CommonComponents;
const { default: api, useConnectApi } = window.pluginLib.API;
const ReactRedux = window.pluginLib.ReactRedux;
const {
  Paper,
  IconButton,
  InputLabel,
  FormControl,
  Link,
  MenuItem,
  Select,
  Tooltip,
} = window.pluginLib.MuiCore;
const { makeStyles } = window.pluginLib.MuiStyles;

const decoder = new TextDecoder('utf-8');

const useTraceViewerStyle = makeStyles({
  containerFormControl: {
    minWidth: '11rem',
  }
});

function TraceViewer(props) {
  const {trace, open, onClose, ...other} = props;
  const [logs, setLogs] = React.useState([]);
  const [lines, setLines] = React.useState(100);
  const classes = useTraceViewerStyle();

  React.useEffect(() => {
    if (!trace || !open) {
      return;
    }

    function setLogsDebounced(text) {
      setLogs(text);
    }

    const debouncedSetState = _.debounce(setLogsDebounced, 500, {
      leading: true,
      trailing: true,
      maxWait: 1000
    });

    let traces = [];
    setLogs([]);

    const cmd = ['/bin/sh', '-c', `curl --silent --unix-socket /run/traceloop.socket 'http://localhost/dump-by-traceid?traceid=${encodeURIComponent(trace.traceid)}' | tail -n${lines}`];
    const exec = api.exec(trace.pod.metadata.namespace,
      trace.pod.metadata.name,
      'gadget',
      items => {
        if (items) {
          const text = decoder.decode(items.slice(1));
          if ((new Uint8Array(items))[0] !== 1) {
            return;
          }
          traces = traces.concat([text]);
          debouncedSetState(traces);
        }
      },
      {command: cmd, reconnectOnFailure: false});

    return function cleanup() {
      exec.cancel();
    };
  },
  [open, trace, lines]);

  function handleLinesChange(event) {
    setLines(event.target.value);
  }

  return (!trace ?
    null
    :
    <LogViewer
      title={`Traces: ${trace.podname}`}
      downloadName={`${trace.podname}_${trace.traceid}`}
      logs={logs}
      onClose={onClose}
      open={open}
      topActions={[
        <FormControl className={classes.containerFormControl}>
          <InputLabel shrink id="trace-lines-chooser-label">
            Lines
          </InputLabel>
          <Select
            labelId="trace-lines-chooser-label"
            id="trace-lines-chooser"
            value={lines}
            onChange={handleLinesChange}
          >
            {[100, 500, 1000, 2500].map((i) =>
              <MenuItem value={i} key={i}>{i}</MenuItem>
            )}
          </Select>
        </FormControl>
      ]}
      {...other}
    />
  );
}

const useStyle = makeStyles({
  link: {
    cursor: 'pointer'
  }
});

const TRACE_CONTENT_KEY = 'traceloop.kinvolk.io/state';
const IG_CONTAINER_KEY = 'k8s-app';
const IG_CONTAINER_VALUE = 'gadget';
const TRACE_POD_READY_STATUS = 'ready';

function isIGPod(podResource) {
  return podResource.metadata.labels[IG_CONTAINER_KEY] === IG_CONTAINER_VALUE;
}

function getIGPodTraces(pod) {
  const podTraces = JSON.parse(pod.metadata.annotations[TRACE_CONTENT_KEY] || '[]');

  // Some traces have no podname and we don't want to show those.
  // We should emove it if Inspektor Gadget stops including such results.
  const validTraces = podTraces.filter(trace => !!trace.podname);
  validTraces.forEach(trace => { trace['pod'] = pod; });

  return validTraces;
}

function TraceList() {
  const [traces, setTraces] = React.useState(null);
  const [trace, setTrace] = React.useState(null);
  const [open, setOpen] = React.useState(false);
  const filter = ReactRedux.useSelector(state => state.filter);
  const classes = useStyle();

  function setIGPods(items) {
    const igPods = items.filter(item => isIGPod(item));
    setTraces(getAllTraces(igPods));
  }

  useConnectApi(
    api.pod.list.bind(null, null, setIGPods),
  );

  function makeStatusLabel(trace) {
    const status = trace.status;
    return (
      <StatusLabel>
        {status}
      </StatusLabel>
    );
  }

  function getAllTraces(podList) {
    if (!podList) {
      return null;
    }

    let traces = [];
    for (const pod of podList) {
      traces = traces.concat(getIGPodTraces(pod));
    }

    return traces;
  }

  function showTrace(trace) {
    setTrace(trace);
    setOpen(true);
  }

  function sortByStatus(traces) {
    if (!traces) {
      return traces;
    }

    return traces.sort((traceA, traceB) => {
      if (traceA.status !== TRACE_POD_READY_STATUS) {
        return -1;
      }
      if (traceB.status !== TRACE_POD_READY_STATUS) {
        return 1;
      }
      return 0;
    });
  }

  function filterFunc(item) {
    let matches = true;

    if (item.namespace && filter.namespaces.size > 0) {
      matches = filter.namespaces.has(item.namespace);
    }

    if (matches && filter.search) {
      const filterString = filter.search.toLowerCase();
      const matchCriteria = [
        item.namespace.toLowerCase(),
        item.podname.toLowerCase(),
        item.status.toLowerCase(),
      ];

      matches = matchCriteria.find(item => item.includes(filterString));
    }

    return matches;
  }

  return (
    <Paper>
      <SectionFilterHeader title="Traces" />
      <SectionBox>
        <SimpleTable
          rowsPerPage={[15, 25, 50]}
          filterFunction={filterFunc}
          columns={[
            {
              label: 'Name',
              getter: (trace) =>
                <Link
                  className={classes.link}
                  onClick={() => showTrace(trace)}
                >
                  {trace.podname}
                </Link>
            },
            {
              label: 'Namespace',
              getter: (trace) => trace.namespace
            },
            {
              label: 'Status',
              getter: makeStatusLabel
            },
            {
              label: 'Age',
              getter: (trace) => timeAgo(trace.timecreation)
            },
          ]}
          data={sortByStatus(traces)}
        />
        <TraceViewer
          open={open}
          trace={trace}
          onClose={() => setOpen(false)}
        />
      </SectionBox>
    </Paper>
  );
}

function TraceIcon(props) {
  const {item} = props;
  const [open, setOpen] = React.useState(false);
  const [igPod, setIGPod] = React.useState(null);
  const [trace, setTrace] = React.useState(null);
  console.log(props);

  function setPods(pods) {
    for (const pod of pods) {
      if (!isIGPod(pod)) {
        continue;
      }

      const itemTrace = getIGPodTraces(pod).find(({podname, namespace}) =>
        item.metadata.name === podname && item.metadata.namespace === namespace);
      if (!!itemTrace) {
        if (!!trace && trace.traceid === itemTrace.traceid) {
          return;
        }
        setIGPod(pod);
        setTrace(itemTrace);
        break;
      }
    };
  }

  React.useEffect(() => {
    if (!item || item.kind !== 'Pod') {
      return;
    }

    let cancel;

    if (!igPod) {
      cancel = api.pod.list.bind(null, null, setPods);

      return function cleanup() {
        cancel();
      };
    }

    cancel = api.pod.get.bind(null, igPod.metadata.namespace, igPod.metadata.name,
                              (pod) => setPods([pod]));

    return function cleanup() {
      cancel();
    };
  },
  // eslint-disable-next-line react-hooks/exhaustive-deps
  [item, igPod]);

  return (item && item.kind === 'Pod' && trace ?
    <React.Fragment>
      <Tooltip title="See traces">
        <IconButton
          aria-label="see-traces"
          onClick={() => setOpen(true)}
        >
          <Icon icon={tracesIcon} />
        </IconButton>
      </Tooltip>
      <TraceViewer
        open={open}
        trace={trace}
        onClose={() => setOpen(false)}
      />
    </React.Fragment>
    :
    null
  );
}

class Plugin {
  initialize(register) {
    // Add a Traces sidebar item under the Cluster one
    register.registerSidebarItem('cluster', 'traces', 'Traces', '/traces');

    // Add a route that will display the given component and select the "traces"
    // sidebar item.
    register.registerRoute({
      path: '/traces',
      sidebar: 'traces',
      component: () => <TraceList />
    });

    // Add a Traces sidebar item under the Cluster one
    register.registerDetailsViewHeaderAction('traces', (props) => <TraceIcon {...props} />);
  }
}

window.registerPlugin('inspektor-gadget', new Plugin());
