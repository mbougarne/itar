package com.itar.adapter

import android.view.View
import com.facebook.react.bridge.Arguments
import com.facebook.react.bridge.ReactContext
import com.facebook.react.bridge.WritableMap
import com.facebook.react.uimanager.UIManagerHelper
import com.facebook.react.uimanager.events.Event

internal object NativeEvents {
    private class Record(surface: Int, tag: Int, private val name: String, private val data: WritableMap) : Event<Record>(surface, tag) {
        override fun getEventName() = name
        override fun getEventData() = data
        override fun canCoalesce() = false
    }
    fun emit(view: View, name: String, values: Map<String, String>, allowDetached: Boolean = false) {
        val context = view.context as? ReactContext ?: return
        if (view.id == View.NO_ID || (!allowDetached && !view.isAttachedToWindow) || !context.hasActiveReactInstance()) return
        val data = Arguments.createMap().apply { values.forEach { (key, value) -> putString(key, value) } }
        UIManagerHelper.getEventDispatcherForReactTag(context, view.id)?.dispatchEvent(
            Record(UIManagerHelper.getSurfaceId(view), view.id, name, data))
    }
}
