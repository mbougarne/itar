package com.itar.adapter

// In consumer and release variants the Kotlin compiler erases each capture block.
@Suppress("NOTHING_TO_INLINE", "UNUSED_PARAMETER")
internal inline fun captureFocus(block: (FocusTraceSink) -> Unit) = Unit
