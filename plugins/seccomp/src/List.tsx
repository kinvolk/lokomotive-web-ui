import { SeccompProfilesApi } from './api';

const pluginLib = window.pluginLib;
const { SectionBox, SectionFilterHeader, Link, SimpleTable } = pluginLib.CommonComponents;
const React = pluginLib.React;
const K8s = pluginLib.K8s.ResourceClasses;
const { Namespace } = K8s;

export default function SeccompPolicyList() {
  const [namespaces] = Namespace.useList();
  const [seccompData, setSeccompData] = React.useState(null);

  React.useEffect(() => {
    if (namespaces) {
      SeccompProfilesApi.list('', (data: any) => {
        const massagedData: any = [];
        namespaces.forEach((namespace: any) => {
          massagedData.push({ namespace: namespace.metadata.name, policyCount: 0 });
        });
        data.forEach((item: any) => {
          const elementFound = massagedData.find(
            (element: any) => element.namespace === item.metadata.namespace
          );
          if (elementFound) {
            elementFound.policyCount++;
            elementFound.data = item;
          }
        });
        setSeccompData(massagedData);
      });
    }
  }, [namespaces]);
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
