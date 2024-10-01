import Module from "./nx_iree_runtime.mjs";

export const WasmWebcamHookMount = (hook) => {
  const fps = 1;
  const interval = 1000 / fps;

  console.log(hook);

  const video = document.getElementById("wasm-webcam");

  function processFrame(video) {
    const canvas = document.createElement("canvas");
    canvas.width = video.videoWidth;
    canvas.height = video.videoHeight;
    const context = canvas.getContext("2d");
    context.drawImage(video, 0, 0, canvas.width, canvas.height);

    // Get the ImageData object from the canvas (whole canvas)
    const inputData = context.getImageData(0, 0, canvas.width, canvas.height);

    // Extract the pixel data from ImageData (returns a Uint8ClampedArray)
    const uint8ClampedArray = inputData.data;

    // Convert the Uint8ClampedArray to a Uint8Array (if necessary)
    const inputArray = new Uint8Array(uint8ClampedArray);

    (async () => {
      const instance = await Module();

      let device = instance.createDevice();
      let type = "u8";
      let shape = new Int32Array([canvas.height, canvas.width, 4]);
      let input = new instance.Tensor.create(inputArray, shape, type);

      const bytecode_data = atob(video.getAttribute("data-bytecode"));

      // Create a Uint8Array from the decoded base64 string
      const bytecode_uint8Array = new Uint8Array(bytecode_data.length);

      for (let i = 0; i < bytecode_data.length; i++) {
        bytecode_uint8Array[i] = bytecode_data.charCodeAt(i);
      }

      let bytecode = new instance.DataBuffer.create(bytecode_uint8Array);
      let vminstance = instance.createVMInstance();
      let inputs = new instance.vector_Tensor();
      inputs.push_back(input);

      let [call_status, outputs] = instance.call(
        vminstance,
        device,
        bytecode,
        inputs
      );

      if (!instance.statusIsOK(call_status)) {
        console.error("Error calling the VM instance");
        console.error(instance.getStatusMessage(call_status));
        return;
      }

      outputs.get(0).serialize();
      const outputArray = outputs.get(0).toFlatArray();

      const outputCanvas = document.getElementById("wasm-webcam-output");
      const outputContext = outputCanvas.getContext("2d");

      // Create an ImageData object
      let imageData = outputContext.createImageData(
        canvas.width,
        canvas.height
      );

      // Fill the ImageData object with the Uint8Array data
      for (let i = 0; i < outputArray.length; i++) {
        imageData.data[i] = outputArray[i];
      }

      // Draw the ImageData onto the canvas
      outputContext.putImageData(imageData, 0, 0);

      device.delete();
      vminstance.delete();
    })();
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
