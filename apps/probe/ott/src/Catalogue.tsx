import React, {useState} from 'react';
import {View} from 'react-native';
import {FocusScope, occurrenceKey} from 'itar/react';
import Browse from './Browse';
import {categories, type Category} from './catalog';
import {Action} from './ui';
import {useDesign} from './theme';
export default function Catalogue(props: React.ComponentProps<typeof Browse>) {
  const {s} = useDesign();const [category, setCategory] = useState<Category>('All');
  return <View style={s.fill}>
    <FocusScope id="categories" layout="row" boundary="parent" style={s.filters}>
      {categories.map((name, order) => <Action key={name} order={order} id={occurrenceKey(props.id, 'category', name)}
        label={`${name}${category === name ? ', selected' : ''}`} displayLabel={name} highContrast={props.highContrast}
        style={[s.filter, category === name && s.selectedTab]} onPress={() => setCategory(name)} />)}
    </FocusScope>
    <Browse key={category} {...props} id={`${props.id}:${category}`} category={category} grid />
  </View>;
}
