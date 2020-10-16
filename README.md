# Lokomotive Web UI <img align="right" width=384 src="https://raw.githubusercontent.com/kinvolk/lokomotive/master/docs/images/lokomotive-logo.svg">

Lokomotive is an open source Kubernetes distribution that ships pure upstream
Kubernetes.

It focuses on being minimal, easy to use, and secure by default.

Lokomotive Web UI is the graphical user-interface we provide for it, which is built on top of
[Headlamp](https://github.com/kinvolk/headlamp).

## Plugins

The Lokomotive Web UI uses Headlamp with the following plugins:

* [Inspektor Gadget Traces](./plugins/ig-traces): If Inspektor Gadget is installed in the cluster, then this
  plugin will show the trace logs for pods (even defunct ones).
* [Monitor Link](./plugins/monitor-link): If Grafana is installed in the cluster, then this plugin shows a
  link to the Grafana dashboard on the top bar.

## Contributing

Check out Kinvolk's [contributing](https://github.com/kinvolk/contribution) guidelines and Code of Conduct,
which also apply to this project.

Documentation more related to the Lokomotive Web UI will be added later.

## License

Lokomotive Web UI is licensed under the [Apache 2.0 license](./LICENSE).
