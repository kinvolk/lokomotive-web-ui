const pluginLib = window.pluginLib;

const { ApiProxy } = pluginLib;

enum POSSIBLE_WORKLOADS {
  POD = 'Pod',
  DEPLOYMENT = 'Deployment',
  DAEMONSET = 'DaemonSet',
  STATEFULSET = 'StatefulSet',
  REPLICASET = 'ReplicaSet',
  JOBS = 'Job',
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
  kind: POSSIBLE_WORKLOADS = POSSIBLE_WORKLOADS.POD
): Promise<
  [
    {
      kind: POSSIBLE_WORKLOADS;
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

async function FindRootWorkload(
  podName: string,
  namespace: string,
  kind: POSSIBLE_WORKLOADS = POSSIBLE_WORKLOADS.POD
): Promise<{ kind: string; name: string }> {
  try {
    const ownerReferences: Array<{
      kind: POSSIBLE_WORKLOADS;
      name: string;
    }> = await getOwnerReference(podName, namespace, kind);
    if (!ownerReferences) {
      // this means the current kind property set is the root parent workload
      return { kind, name: podName };
    } else {
      if (!Object.values(POSSIBLE_WORKLOADS).includes(ownerReferences[0].kind)) {
        return { kind, name: podName };
      }
      return FindRootWorkload(ownerReferences[0].name, namespace, ownerReferences[0].kind);
    }
  } catch (error) {
    throw new Error(`Error getting the root parent workload`);
  }
}

export function parseSeccompAnnotations(data: any, annotationKind: string, namespace: string) {
  return (
    (data.metadata.annotations &&
      data.metadata.annotations[`seccomp.gadget.kinvolk.io/${annotationKind}`]) ||
    ''
  ).replace(namespace + '/', '');
}

export function checkIfPolicyNotApplied(context: any) {
  if (!context) {
    return true;
  }
  return Object.keys(context).length === 0 || context?.seccompProfile?.type === 'Unconfined';
}

export default FindRootWorkload;
