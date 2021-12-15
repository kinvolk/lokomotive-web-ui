const pluginLib = window.pluginLib;

const { ApiProxy } = pluginLib;
const K8s = pluginLib.K8s.ResourceClasses;
const ResourceAPI = new K8s.CustomResource('gadget.kinvolk.io', 'v1alpha1', 'traces');

export const SeccompProfilesApi = ApiProxy.apiFactoryWithNamespace(
  ['security-profiles-operator.x-k8s.io', 'v1beta1', 'seccompprofiles'],
  ['security-profiles-operator.x-k8s.io', 'v1alpha1', 'seccompprofiles']
);

export function startRecordingSysCalls(namespace: string) {
  return ResourceAPI.patch(
    [
      { op: 'replace', path: '/spec/filter/namespace', value: namespace },
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

export function stopSysCallGathering() {
  return ResourceAPI.patch(
    [
      { op: 'add', path: '/metadata/annotations/gadget.kinvolk.io~1operation', value: 'stop' },
      { op: 'remove', path: '/metadata/annotations/headlampSeccompTimestamp' },
    ],
    'gadget',
    'seccomp'
  );
}

export function generateSeccompProfile(namespace: string, pods: any) {
  const runningPods = pods.filter((pod: any) => pod?.status.phase === 'Running');

  const generateSeccompApiForPods = runningPods.map((pod: any) => {
    return ResourceAPI.patch(
      [
        {
          op: 'add',
          path: '/metadata/annotations/gadget.kinvolk.io~1operation',
          value: 'generate',
        },
        {
          op: 'add',
          path: '/spec/filter/podname',
          value: pod.metadata.name,
        },
        {
          op: 'replace',
          path: '/spec/output',
          value: `${namespace}/${pod.metadata.name}`,
        },
      ],
      'gadget',
      'seccomp'
    );
  });
  return Promise.all(generateSeccompApiForPods);
}

export function getSeccompResult(cb: (data: any) => void) {
  return ResourceAPI.apiEndpoint.get('gadget', 'seccomp', function (data: any) {
    cb(data);
  });
}

export function addTimestamp(timestamp?: string, timestampName?: string) {
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

export function updateSeccompPolicy(body: any) {
  return SeccompProfilesApi.put(body);
}

export function deleteSeccompPolicy(body: any) {
  return SeccompProfilesApi.delete(body.metadata.namespace, body.metadata.name);
}

export function applySeccompProfileToWorkload(
  name: string,
  namespace: string,
  kind: string,
  seccompProfile: { type: string; profile: string }
): Promise<any> {
  return K8s[kind].apiEndpoint.patch(
    [
      {
        op: 'add',
        path: '/spec/template/spec/securityContext/seccompProfile',
        value: { type: seccompProfile.type, localhostProfile: seccompProfile.profile },
      },
    ],
    namespace,
    name
  );
}

