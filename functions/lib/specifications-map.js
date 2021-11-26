const getColor = require('./colors-map')

module.exports = [
  {
    attribute: 'energy_efficiency_class',
    gmcAttribute: 'energy_efficiency_class'
  },
  {
    attribute: 'age_group',
    gmcAttribute: 'age_group',
    onlySpecification: true
  },
  {
    attribute: 'gender',
    gmcAttribute: 'gender',
    onlySpecification: true
  },
  {
    attribute: 'material',
    gmcAttribute: 'material'
  },
  {
    attribute: 'pattern',
    gmcAttribute: 'pattern'
  },
  {
    attribute: 'size',
    gmcAttribute: 'size'
  },
  {
    attribute: 'size_type',
    gmcAttribute: 'size_type'
  },
  {
    attribute: 'size_system',
    gmcAttribute: 'size_system'
  },
  {
    attribute: 'colors',
    gmcAttribute: 'color',
    formatter: (feedSpecification) => {
      const colors = feedSpecification.split('/')
      const specColors = []
      for (const color of colors) {
        specColors.push({
          text: color,
          value: getColor(color.toLowerCase())
        })
      }
      return specColors
    }
  }
]
