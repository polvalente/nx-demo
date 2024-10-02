import Module from "./nx_iree_runtime.mjs";

export const WasmWebcamHookMount = async (hook) => {
  const fps = 30;
  const interval = 1000 / fps;

  const instance = await Module();
  let device = instance.createDevice();
  const video = document.getElementById("wasm-webcam");
  let vminstance = instance.createVMInstance();

  hook.runtime = { instance, device };

  let type = "u8";

  const canvas = document.getElementById("wasm-webcam-input");
  const context = canvas.getContext("2d", { willReadFrequently: true });
  const outputCanvas = document.getElementById("wasm-webcam-output");
  const outputContext = outputCanvas.getContext("2d");
  canvas.width = 0 + video.getAttribute("width");
  canvas.height = 0 + video.getAttribute("height");

  // Create an ImageData object
  let imageData = outputContext.createImageData(canvas.width, canvas.height);

  hook.durations = {
    input: null,
    call: null,
    output: null,
    bytecode: null,
  };

  function processFrame(video) {
    if (video.videoWidth == 0 || video.videoHeight == 0) {
      return;
    }

    context.drawImage(video, 0, 0, canvas.width, canvas.height);

    const inputStart = performance.now();
    // Get the ImageData object from the canvas (whole canvas)
    const inputData = context.getImageData(0, 0, canvas.width, canvas.height);

    // Extract the pixel data from ImageData (returns a Uint8ClampedArray)
    const uint8ClampedArray = inputData.data;

    // Convert the Uint8ClampedArray to a Uint8Array (if necessary)
    const inputArray = new Uint8Array(uint8ClampedArray);
    let shape = new Int32Array([canvas.height, canvas.width, 4]);

    let input = undefined;
    try {
      input = new instance.Tensor.create(
        inputArray,
        shape,
        type,
        hook.runtime.device
      );
    } catch (error) {
      console.error(error);
      return;
    }

    let inputs = new instance.vector_Tensor();
    inputs.push_back(input);

    const inputDuration = performance.now() - inputStart;
    hook.durations.input = hook.durations.input
      ? (inputDuration + hook.durations.input) / 2
      : inputDuration;

    // let bytecode = hook.runtime.bytecode;

    const bytecodeStart = performance.now();
    // if (!hook.runtime.bytecode) {
    const bytecode_data = atob(video.getAttribute("data-bytecode"));

    // Create a Uint8Array from the decoded base64 string
    const bytecode_uint8Array = new Uint8Array(bytecode_data.length);

    for (let i = 0; i < bytecode_data.length; i++) {
      bytecode_uint8Array[i] = bytecode_data.charCodeAt(i);
    }

    const bytecode = new instance.DataBuffer.create(bytecode_uint8Array);
    const bytecodeDuration = performance.now() - bytecodeStart;
    hook.durations.bytecode = hook.durations.bytecode
      ? (bytecodeDuration + hook.durations.bytecode) / 2
      : bytecodeDuration;

    const callStart = performance.now();

    let [call_status, outputs] = instance.call(
      vminstance,
      device,
      bytecode,
      inputs
    );

    const callDuration = performance.now() - callStart;
    hook.durations.call = hook.durations.call
      ? (callDuration + hook.durations.call) / 2
      : callDuration;

    bytecode.delete();

    if (!instance.statusIsOK(call_status)) {
      console.error("Error calling the VM instance");
      console.error(instance.getStatusMessage(call_status));

      call_status.delete();
      inputs.delete();
      return;
    }

    call_status.delete();

    const outputStart = performance.now();
    const outputTensor = outputs.get(0);
    const outputArray = outputTensor.toFlatArray();
    outputs.delete();

    imageData.data.set(outputArray);

    // Draw the ImageData onto the canvas
    outputContext.putImageData(imageData, 0, 0);
    const outputDuration = performance.now() - outputStart;
    hook.durations.output = hook.durations.output
      ? (outputDuration + hook.durations.output) / 2
      : outputDuration;

    inputs.delete();

    let metrics = [];
    Object.keys(hook.durations).forEach((key) => {
      metrics.push(`${key}: ${hook.durations[key].toFixed(2)}ms`);
    });
    console.group(metrics);
    console.groupEnd();
  }

  if (navigator.mediaDevices.getUserMedia) {
    navigator.mediaDevices
      .getUserMedia({ video: true })
      .then(function (stream) {
        video.srcObject = stream;
        setInterval(processFrame, interval, video);
      })
      .catch(function (error) {
        console.log("Something went wrong!");
      });
  }
};

export const WasmWebcamHookDestroy = (hook) => {
  hook.runtime.bytecode.delete();
  hook.runtime.device.delete();
  hook.runtime.vminstance.delete();
};
