package com.itar.adapter

internal data class Mount(val slot: Long, val generation: Long, val serial: Long, val key: String) {
    fun values(epoch: Long = 0) = longArrayOf(slot, generation, serial, epoch)
}
