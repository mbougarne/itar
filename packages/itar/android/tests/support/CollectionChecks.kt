package com.itar.adapter

/** Debug-only checks and observation for the actual React consumer instrumentation. */
object CollectionChecks {
    fun leadingRowOffsets() {
        val list = CollectionEntry("catalogue", "", 0, true, true, 2, 420.0, 624.0)
        check(list.offset(0) == 0.0)
        check(list.offset(1) == 624.0)
        check(list.offset(2) == 1044.0)
        check(list.copy(leadingExtent = 0.0).offset(2) == 840.0)
        val invalid = """{"dataset":"1","nodes":[{"key":"list","parent":"","order":0,"scope":true,"enabled":true,"layout":2,"extent":420,"leadingExtent":-1}]}"""
        check(CollectionDocument.decode(invalid) == null)
    }
    data class Focus(val kind: Long, val key: String, val confirmed: Long)
    fun observe(root: SurfaceView, records: MutableList<Focus>): () -> Unit {
        val previous = root.onFocusRecord
        root.onFocusRecord = { record ->
            if (record[2] == 0L) {
                check(records.size < 128) { "Collection observation bound exceeded" }
                val key = root.targets.keys.firstOrNull {
                    it.slot == record[4] && it.generation == record[5] && it.serial == record[6]
                }?.key ?: ""
                records.add(Focus(record[3], key, record[7]))
            }
            previous?.invoke(record)
        }
        return { if (!root.closed) root.onFocusRecord = previous }
    }
}
