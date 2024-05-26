defmodule ElixirDays.Application do
  # See https://hexdocs.pm/elixir/Application.html
  # for more information on OTP Applications
  @moduledoc false

  use Application

  @impl true
  def start(_type, _args) do
    {:ok, resnet} = Bumblebee.load_model({:hf, "microsoft/resnet-50"})
    {:ok, featurizer} = Bumblebee.load_featurizer({:hf, "microsoft/resnet-50"})
    serving = Bumblebee.Vision.image_classification(resnet, featurizer)

    camera_serving =
      if Application.get_env(:elixir_days, :start_camera_serving) do
        [
          {Nx.Serving,
           name: ImageClassifierServing, serving: serving, batch_size: 10, batch_timeout: 100}
        ]
      else
        []
      end

    children =
      [
        ElixirDaysWeb.Telemetry
      ] ++
        camera_serving ++
        [
          {DNSCluster, query: Application.get_env(:elixir_days, :dns_cluster_query) || :ignore},
          {Phoenix.PubSub, name: ElixirDays.PubSub},
          # Start the Finch HTTP client for sending emails
          {Finch, name: ElixirDays.Finch},
          # Start a worker by calling: ElixirDays.Worker.start_link(arg)
          # {ElixirDays.Worker, arg},
          # Start to serve requests, typically the last entry
          ElixirDaysWeb.Endpoint
        ]

    # See https://hexdocs.pm/elixir/Supervisor.html
    # for other strategies and supported options
    opts = [strategy: :one_for_one, name: ElixirDays.Supervisor]
    Supervisor.start_link(children, opts)
  end

  # Tell Phoenix to update the endpoint configuration
  # whenever the application is updated.
  @impl true
  def config_change(changed, _new, removed) do
    ElixirDaysWeb.Endpoint.config_change(changed, removed)
    :ok
  end
end
