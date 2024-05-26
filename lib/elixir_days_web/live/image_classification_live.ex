defmodule ElixirDaysWeb.ImageClassificationLive do
  use ElixirDaysWeb, :live_view

  def mount(_params, _session, socket) do
    {:ok,
     assign(socket,
       frames: [],
       predictions: %{},
       total_bytes: 0,
       total_seconds: 0,
       start_time: System.monotonic_time(:second)
     )}
  end

  def render(assigns) do
    ~H"""
    <div id="webcam-container" phx-hook="WebcamHook">
      <video id="webcam" width="640" height="480" autoplay></video>
    </div>
    <div class="py-4" style="width: 640px">
      <%= for prediction <- Enum.sort_by(@predictions, & &1.score, :desc) do %>
        <div class="w-full text-gray-800 text-sm font-semibold mr-2 mb-2">
          <div class="inline-block w-1/6" />
          <div class={"inline-block py-2 px-4 w-1/3 rounded-l-full #{if(prediction.confident?, do: "bg-green-500", else: "bg-gray-200")}"}>
            <%= prediction.label %>
          </div>
          <div class={"inline-block py-2 px-4 w-1/3 rounded-r-full text-center #{if(prediction.confident?, do: "bg-green-500", else: "bg-gray-200")}"}>
            <%= prediction.score %>
          </div>
        </div>
      <% end %>
    </div>
    <div class="">
      <p class="text-sm text-gray-800">
        Total bytes: <%= "#{:erlang.float_to_binary(@total_bytes / 1_000_000, decimals: 2)} MB" %>
      </p>
      <p class="text-sm text-gray-800">Total seconds: <%= @total_seconds %></p>
      <p class="text-sm text-gray-800">
        Average Data Rate: <%= if(@total_seconds == 0,
          do: "0",
          else: :erlang.float_to_binary(@total_bytes / (@total_seconds * 1_000), decimals: 2)
        ) <> " KB/s" %>
      </p>
    </div>
    """
  end

  def handle_event("frame", %{"frame" => frame_data}, socket) do
    frame_data = Base.decode64!(frame_data)
    # image = StbImage.read_binary!(frame_data)

    z = :zlib.open()
    :ok = :zlib.inflateInit(z)
    decompressed_data = :zlib.inflate(z, frame_data)
    :ok = :zlib.inflateEnd(z)
    :zlib.close(z)

    decompressed_data = IO.iodata_to_binary(decompressed_data)
    image = StbImage.read_binary!(decompressed_data)

    %{predictions: classification} = Nx.Serving.batched_run(ImageClassifierServing, image)

    classification =
      Enum.map(classification, fn %{score: score, label: label} ->
        if score > 0.1 do
          score = trunc(score * 10 ** 3)
          [label | _] = String.split(label, ",", parts: 2)
          %{confident?: score > 0.5, score: "#{div(score, 10)}.#{rem(score, 10)}%", label: label}
        else
          %{confident?: false, score: "-", label: "-"}
        end
      end)

    {:noreply,
     assign(socket,
       predictions: classification,
       total_bytes: socket.assigns.total_bytes + byte_size(frame_data),
       total_seconds: System.monotonic_time(:second) - socket.assigns.start_time
     )}
  end
end
