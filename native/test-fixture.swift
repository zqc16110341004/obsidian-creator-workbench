import AppKit
let size=NSSize(width:1200,height:700)
let image=NSImage(size:size)
image.lockFocus()
NSColor.white.setFill();NSRect(origin:.zero,size:size).fill()
func text(_ value:String,_ x:Double,_ y:Double,_ font:Double=34){(value as NSString).draw(at:NSPoint(x:x,y:y),withAttributes:[.font:NSFont.systemFont(ofSize:font),.foregroundColor:NSColor.black])}
text("功能验收截图 · 合成数据，未真实发布",60,600,38)
text("仅验证指标识别，请勿用于真实效果分析",60,540,26)
text("播放量：1.2万",70,410,42)
text("点赞：68",650,410,42)
text("收藏：42",70,270,42)
text("评论：0",650,270,42)
text("截图日期：2026-10-17",60,100,26)
image.unlockFocus()
let bitmap=NSBitmapImageRep(data:image.tiffRepresentation!)!
try bitmap.representation(using:.png,properties:[:])!.write(to:URL(fileURLWithPath:CommandLine.arguments[1]))
