package com.itar.adapter

import android.os.Build
import android.util.AtomicFile
import java.io.File
import org.json.JSONArray
import org.json.JSONException
import org.json.JSONObject

// React's wire target is a tagged JSON string. Native fixture keys are already plain strings.
private fun occurrence(key: String?): String? {
    if (key == null || !key.startsWith("[")) return key
    return try {
        val parts = JSONArray(key)
        if (parts.length() == 2 && parts.opt(0) == "target" && parts.opt(1) is String) parts.getString(1) else key
    } catch (_: JSONException) { key }
}

internal fun recordingJson(snapshot: OccoSnapshot): String {
    val events = JSONArray()
    for (event in snapshot.events) events.put(JSONObject().apply {
        put("seq", event.seq)
        put("ms", event.ms)
        put("kind", event.kind)
        fun id(name: String, value: Long) { if (value != 0L) put(name, value.toString()) }
        id("surface", event.surface)
        id("request", event.request)
        id("effect", event.effect)
        id("move", event.move)
        id("mount", event.mount)
        putOpt("target", occurrence(event.target))
        putOpt("owner", event.owner)
        putOpt("channel", event.channel)
        putOpt("direction", event.direction)
        putOpt("detail", event.detail)
        event.nativeDestination?.let { destination ->
            put("nativeDestination", JSONObject().apply {
                put("role", destination.role)
                destination.bounds?.let { bounds ->
                    put("bounds", JSONObject().apply {
                        put("left", bounds.left)
                        put("top", bounds.top)
                        put("right", bounds.right)
                        put("bottom", bounds.bottom)
                    })
                }
            })
        }
    })
    return JSONObject().apply {
        put("format", "occo")
        put("version", 1)
        put("state", snapshot.state)
        put("capacity", snapshot.capacity)
        put("dropped", snapshot.dropped)
        put("device", JSONObject().apply {
            put("model", Build.MODEL)
            put("android", Build.VERSION.RELEASE)
            put("api", Build.VERSION.SDK_INT)
            putOpt("accessibilityEnabledAtStart", snapshot.accessibilityEnabledAtStart)
            putOpt("touchExplorationAtStart", snapshot.touchExplorationAtStart)
        })
        put("events", events)
    }.toString()
}

internal fun writeRecording(filesDir: File, contents: String): File {
    val dir = File(filesDir, "occo")
    check(dir.isDirectory || dir.mkdirs()) { "Cannot create recording directory" }
    val destination = File(dir, "latest.json")
    val file = AtomicFile(destination)
    val stream = file.startWrite()
    try {
        stream.write(contents.toByteArray(Charsets.UTF_8))
        file.finishWrite(stream)
    } catch (failure: Exception) {
        file.failWrite(stream)
        throw failure
    }
    return destination
}
