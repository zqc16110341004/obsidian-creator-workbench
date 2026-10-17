import Foundation
import Vision
import ImageIO

func fail(_ text: String) -> Never {
    FileHandle.standardError.write(Data(text.utf8)); exit(1)
}
let data = FileHandle.standardInput.readDataToEndOfFile()
guard !data.isEmpty && data.count <= 8 * 1024 * 1024,
      let source = CGImageSourceCreateWithData(data as CFData, nil),
      let props = CGImageSourceCopyPropertiesAtIndex(source, 0, nil) as? [CFString: Any],
      let width = props[kCGImagePropertyPixelWidth] as? Int,
      let height = props[kCGImagePropertyPixelHeight] as? Int,
      width > 0 && height > 0 && width <= 16000 && height <= 16000 && width * height <= 40000000
else { fail("图片无法读取或尺寸超过限制") }
let request = VNRecognizeTextRequest()
request.recognitionLevel = .accurate
request.recognitionLanguages = ["zh-Hans", "en-US"]
request.usesLanguageCorrection = false
let handler = VNImageRequestHandler(data: data, options: [:])
do {
    try handler.perform([request])
    let results = request.results ?? []
    guard results.count <= 500 else { fail("图片文字过多，请选择只包含本条内容指标的截图") }
    let lines: [[String: Any]] = results.compactMap { observation in
        guard let text = observation.topCandidates(1).first else { return nil }
        let box = observation.boundingBox
        return ["text": String(text.string.prefix(300)), "confidence": text.confidence,
                "x": box.minX, "y": 1 - box.maxY, "w": box.width, "h": box.height]
    }
    let result: [String: Any] = ["lines": lines, "width": width, "height": height]
    let output = try JSONSerialization.data(withJSONObject: result, options: [.sortedKeys])
    guard output.count <= 256 * 1024 else { fail("识别结果过大，请缩小截图范围") }
    FileHandle.standardOutput.write(output)
} catch { fail("本地识别失败，请换一张清晰截图或手工填写") }
