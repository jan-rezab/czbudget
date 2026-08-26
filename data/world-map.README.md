# World map geometry

`world-map.v1.json` is reused from the `smtr-web` project and originates from
[`@svg-maps/world`](https://www.npmjs.com/package/@svg-maps/world). The map
geometry is licensed under [CC BY 4.0](https://creativecommons.org/licenses/by/4.0/).

The 23 country-specific municipal reviews are maintained in
`municipal-transparency.v1.json`. `global-budget-transparency.v1.json` joins
those reviews to a 195-state universe and the 125-country Open Budget Survey
2023 central-government scores. Unclassified geometry and any unresearched
state must always render black as “not researched,” never as “does not
publish.” National and municipal findings are separate dimensions.
