import pako from "pako";

export const WebcamHookMount = (hook) => {
  const fps = 1;
  const interval = 1000 / fps;

  function captureFrame(video) {
    const canvas = document.createElement("canvas");
    canvas.width = video.videoWidth;
    canvas.height = video.videoHeight;
    const context = canvas.getContext("2d");
    context.drawImage(video, 0, 0, canvas.width, canvas.height);
    const dataUrl = canvas.toDataURL("image/png");
    const frameData = dataUrl.replace(/^data:image\/(png|jpeg);base64,/, "");
    hook.pushEvent("frame", { frame: frameData });

    // // Create a second canvas for resizing
    // const resizedCanvas = document.createElement("canvas");
    // const resizedContext = resizedCanvas.getContext("2d");

    // // Draw the original canvas onto the resized canvas
    // resizedContext.drawImage(
    //   canvas,
    //   0,
    //   0,
    //   canvas.width,
    //   canvas.height,
    //   0,
    //   0,
    //   244,
    //   244
    // );

    // const dataUrl = resizedCanvas.toDataURL("image/png");
    // const frameData = dataUrl.replace(/^data:image\/(png|jpeg);base64,/, "");

    // // Convert the base64 string to a binary string
    // const binaryString = atob(frameData);

    // // Convert the binary string to a byte array
    // const byteArray = new Uint8Array(binaryString.length);
    // for (let i = 0; i < binaryString.length; i++) {
    //   byteArray[i] = binaryString.charCodeAt(i);
    // }

    // // Compress the byte array using pako
    // const compressedData = pako.deflate(byteArray);

    // // Convert the compressed byte array to a base64 string
    // const compressedBase64 = btoa(
    //   Array.from(compressedData)
    //     .map((char) => String.fromCharCode(char))
    //     .join("")
    // );

    // // Push the frame to LiveView
    // hook.pushEvent("frame", { frame: compressedBase64 });
  }

  const video = document.getElementById("webcam");
  if (navigator.mediaDevices.getUserMedia) {
    navigator.mediaDevices
      .getUserMedia({ video: true })
      .then(function (stream) {
        video.srcObject = stream;
        setInterval(captureFrame, interval, video);
      })
      .catch(function (error) {
        console.log("Something went wrong!");
      });
  }
};
