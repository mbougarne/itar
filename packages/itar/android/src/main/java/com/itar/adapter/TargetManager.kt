package com.itar.adapter

import com.facebook.react.uimanager.SimpleViewManager
import com.facebook.react.uimanager.ThemedReactContext
import com.facebook.react.viewmanagers.ItarTargetManagerDelegate
import com.facebook.react.viewmanagers.ItarTargetManagerInterface

class TargetManager : SimpleViewManager<TargetView>(), ItarTargetManagerInterface<TargetView> {
    override fun getName() = "ItarTarget"
    override fun getDelegate() = ItarTargetManagerDelegate(this)
    override fun createViewInstance(context: ThemedReactContext) = TargetView(context)
    override fun setOccurrenceKey(view: TargetView, value: String?) { view.occurrenceKey = value ?: "" }
    override fun setLabel(view: TargetView, value: String?) { view.text = value; view.contentDescription = value }
    override fun setEnabled(view: TargetView, value: Boolean) { view.isEnabled = value }
    override fun setOrder(view: TargetView, value: Int) { view.order = value }
    override fun setBaseColor(view: TargetView, value: Int?) { view.setBaseColor(value) }
    override fun setFocusColor(view: TargetView, value: Int?) { view.focusColor = value }
    override fun onAfterUpdateTransaction(view: TargetView) { super.onAfterUpdateTransaction(view); view.commitProps() }
    override fun onDropViewInstance(view: TargetView) { view.surface?.detach(view); super.onDropViewInstance(view) }
}
