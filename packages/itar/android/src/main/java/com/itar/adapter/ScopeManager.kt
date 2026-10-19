package com.itar.adapter

import com.facebook.react.uimanager.ThemedReactContext
import com.facebook.react.uimanager.ViewGroupManager
import com.facebook.react.viewmanagers.ItarScopeManagerDelegate
import com.facebook.react.viewmanagers.ItarScopeManagerInterface

class ScopeManager : ViewGroupManager<ScopeView>(), ItarScopeManagerInterface<ScopeView> {
    override fun getName() = "ItarScope"
    override fun getDelegate() = ItarScopeManagerDelegate(this)
    override fun createViewInstance(context: ThemedReactContext) = ScopeView(context)
    override fun setScopeKey(view: ScopeView, value: String?) { view.scopeKey = value ?: "" }
    override fun setParentScopeKey(view: ScopeView, value: String?) { view.parentScopeKey = value ?: "" }
    override fun setActive(view: ScopeView, value: Boolean) { view.active = value }
    override fun setLayout(view: ScopeView, value: String?) { view.layout = value ?: "spatial" }
    override fun setBoundary(view: ScopeView, value: String?) { view.boundary = value ?: "stop" }
    override fun setTrap(view: ScopeView, value: Boolean) { view.trap = value }
    override fun setEntryReady(view: ScopeView, value: Boolean) { view.entryReady = value }
    override fun setPreferredKey(view: ScopeView, value: String?) { view.preferredKey = value ?: "" }
    override fun onAfterUpdateTransaction(view: ScopeView) { super.onAfterUpdateTransaction(view); view.commit() }
    override fun onDropViewInstance(view: ScopeView) { view.recycle(); super.onDropViewInstance(view) }
}
