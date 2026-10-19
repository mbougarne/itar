package com.itar.adapter

internal fun SurfaceView.publishPublic(name: String, values: Map<String, String>) {
    if (eventSequence == Long.MAX_VALUE) { close(); return }
    NativeEvents.emit(this, name, values + mapOf("provider" to providerId, "sequence" to (++eventSequence).toString()),
        allowDetached = name == "topSurfaceRecord")
}

internal fun SurfaceView.emitRequest(record: LongArray, command: String) {
    val statuses = listOf("started", "joined", "busy", "unavailable", "stale", "invalid", "cancelled", "unchanged",
        "confirmed", "reconciled", "expired", "backward_time", "exhausted", "resync", "disposed", "issued", "waiting")
    publishPublic("topRequestRecord", mapOf("lifetime" to connection.lifetime.toString(), "request" to record[2].toString(),
        "status" to (statuses.getOrNull(record[1].toInt()) ?: "invalid"), "command" to command))
    if (record[1] in listOf(3L, 4L, 5L, 6L, 8L, 9L, 10L, 12L, 13L, 14L)) commandRequests.remove(record[2])
}

internal fun SurfaceView.commandBegan(command: String, record: LongArray) {
    if (record[1] == 0L && record[2] != 0L) commandRequests[record[2]] = command
    emitRequest(record, command)
}
internal fun SurfaceView.reconcileCommands(activeRequest: Long) {
    for (request in commandRequests.keys.toList()) {
        if (request != activeRequest) emitRequest(longArrayOf(0, 9, request), commandRequests[request] ?: "")
    }
}
