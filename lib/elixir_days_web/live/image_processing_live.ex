defmodule NxDemoWeb.ImageProcessingLive do
  use NxDemoWeb, :live_view

  def mount(_params, _session, socket) do
    bytecode = compile(socket.assigns)

    {:ok,
     assign(socket,
       frames: [],
       predictions: %{},
       total_bytes: 0,
       total_seconds: 0,
       bytecode: bytecode,
       start_time: System.monotonic_time(:second)
     )}
  end

  defp compile(assigns) do
    iree_compiler_flags = [
      "--iree-hal-target-backends=llvm-cpu",
      "--iree-input-type=stablehlo",
      "--iree-llvmcpu-target-triple=wasm32-unknown-emscripten",
      "--iree-llvmcpu-target-cpu-features=+atomics,+bulk-memory,+simd128"
    ]

    kernel_size = assigns[:kernel_size] || 20

    {:ok, %{bytecode: bytecode}} =
      NxIREE.Compiler.to_bytecode(
        fn image ->
          image
          |> Nx.as_type(:f32)
          |> Nx.window_mean({kernel_size, kernel_size, 1}, padding: :same)
          |> Nx.as_type(:u8)
        end,
        [Nx.template({480, 640, 4}, :u8)],
        iree_compiler_flags: iree_compiler_flags
      )

    bytecode
  end

  def render(assigns) do
    ~H"""
    <div id="wasm-webcam-container" phx-hook="WasmWebcamHook">
      <video
        data-bytecode={Base.encode64(@bytecode)}
        id="wasm-webcam"
        width="640"
        height="480"
        autoplay
      >
      </video>
      <canvas id="wasm-webcam-output" width="640" height="480"></canvas>
    </div>
    """
  end
end
