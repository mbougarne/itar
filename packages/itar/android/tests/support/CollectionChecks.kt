package com.itar.adapter

/** Debug-only value observer for the actual React consumer instrumentation. */
object CollectionChecks {
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
