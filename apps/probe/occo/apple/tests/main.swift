import Foundation

// Run with OccoRecording.swift and -D ITAR_OCCO. The argument is a temporary
// directory. Its final export can be read directly by the shared timeline.
let root = URL(fileURLWithPath: CommandLine.arguments[1], isDirectory: true)
var milliseconds: UInt64 = 40
let recorder = OccoRecording(capacity: 4, clock: { milliseconds })
let device: [String: Any] = ["model": "Synthetic Apple TV", "tvos": "fixture", "voiceOverAtStart": true]

recorder.append(["kind": "input"])
precondition(recorder.state == "idle" && recorder.snapshot().events.isEmpty)
recorder.start(device: device)
for _ in 0..<6 { milliseconds += 1; recorder.mark() }
recorder.freeze()
let ring = recorder.snapshot()
precondition(ring.state == "frozen" && ring.dropped == 4)
precondition(ring.events.compactMap { $0["seq"] as? Int } == [5, 6, 7, 8])
recorder.mark()
precondition(recorder.snapshot().events.count == ring.events.count)

recorder.start(device: device)
recorder.append(["kind": "observation", "target": String(repeating: "🎥", count: 1025)])
precondition(recorder.snapshot().dropped == 1)
recorder.start(device: device)
precondition(recorder.snapshot().dropped == 1) // An active start preserves the recording.
recorder.freeze()
recorder.start(device: device)
let key = "[\"target\",\"row/movie\"]"
let move = UInt64.max - 1
milliseconds += 2
recorder.append(["kind": "request", "surface": UInt64(9), "move": move, "request": UInt64(17), "detail": "cancelled"])
recorder.append(["kind": "observation", "channel": "input", "surface": UInt64(9), "target": key,
                 "mount": UInt64(4), "detail": "callback: managed"])
recorder.append(["kind": "observation", "channel": "accessibility", "surface": UInt64(9), "target": key,
                 "mount": UInt64(5), "detail": "callback: managed"])
recorder.freeze()
let recorded = recorder.snapshot()
recorder.start(device: device)
try ring.write(to: root)
try recorded.write(to: root)
let bytes = try Data(contentsOf: root.appendingPathComponent("occo/latest.json"))
let json = try JSONSerialization.jsonObject(with: bytes) as! [String: Any]
let events = json["events"] as! [[String: Any]]
precondition(json["format"] as? String == "occo" && json["version"] as? Int == 1)
precondition(json["state"] as? String == "frozen" && json["dropped"] as? Int == 1)
precondition(events.compactMap { $0["seq"] as? Int } == [2, 3, 4, 5])
precondition(events.compactMap { $0["ms"] as? UInt64 } == [2, 2, 2, 2])
precondition(events[0]["move"] as? String == String(move))
precondition(events[1]["target"] as? String == "row/movie" && events[1]["mount"] as? String == "4")
precondition(events[2]["target"] as? String == "row/movie" && events[2]["mount"] as? String == "5")
precondition(events.compactMap { $0["channel"] as? String } == ["input", "accessibility"])
print("tvOS recorder fixture passed")
