import React, { useCallback, useState } from 'react';
import { View } from 'react-native';
import { FocusScope, occurrenceKey } from 'itar/react';
import Browse from './Browse';
import type { BrowseProps } from './browse-types';
import { categories, type Category } from './catalog-types';
import { Action } from './components/Action';
import { useDesign } from './theme';

export default function Catalogue(props: BrowseProps) {
  const { s } = useDesign();
  const [category, setCategory] = useState<Category>('All');
  const { id, onReady } = props;

  const reportReady = useCallback(
    () => onReady?.(occurrenceKey(id, 'category', 'All')),
    [id, onReady],
  );

  return (
    <View style={s.fill}>
      <FocusScope
        id="categories"
        layout="row"
        boundary="parent"
        style={s.filters}
      >
        {categories.map((name, order) => (
          <Action
            key={name}
            order={order}
            id={occurrenceKey(props.id, 'category', name)}
            label={`${name}${category === name ? ', selected' : ''}`}
            tvDescription={
              name === 'All'
                ? props.kind === 'movie'
                  ? 'Movies'
                  : 'Series'
                : undefined
            }
            displayLabel={name}
            highContrast={props.highContrast}
            style={[s.filter, category === name && s.selectedTab]}
            onPress={() => setCategory(name)}
          />
        ))}
      </FocusScope>
      <Browse
        key={category}
        {...props}
        onReady={reportReady}
        id={`${props.id}:${category}`}
        category={category}
        grid
      />
    </View>
  );
}
