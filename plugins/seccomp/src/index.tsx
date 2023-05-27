import Registry from '@kinvolk/headlamp-plugin/types/plugin/registry.d';
import SeccompPolicyList from './List';
import SeccompPolicyView from './PolicyView';
const pluginLib = window.pluginLib
const React = pluginLib.React;

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
