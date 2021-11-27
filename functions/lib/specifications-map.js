const getColor = require('./colors-map')

module.exports = [
  {
    attribute: 'energy_efficiency_class',
    gmcAttribute: 'energy_efficiency_class'
  },
  {
    attribute: 'age_group',
    gmcAttribute: 'age_group',
    onlySpecification: false
  },
  {
    attribute: 'gender',
    gmcAttribute: 'gender',
    onlySpecification: false
  },
  {
    attribute: 'material',
    gmcAttribute: 'material',
    isVariation: true
  },
  {
    attribute: 'pattern',
    gmcAttribute: 'pattern',
    isVariation: true
  },
  {
    attribute: 'size',
    gmcAttribute: 'size',
    isVariation: true
  },
  {
    attribute: 'size_type',
    gmcAttribute: 'size_type',
    isVariation: true
  },
  {
    attribute: 'size_system',
    gmcAttribute: 'size_system',
    isVariation: true
  },
  {
    attribute: 'colors',
    gmcAttribute: 'color',
    isVariation: true,
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
  },
  {
    attribute: 'custom_label_0',
    gmcAttribute: 'custom_label_0',
    isVariation: true,
    formatter: (feedSpecification) => {
      return [
        {
          text: feedSpecification, value: feedSpecification
        }
      ]
    }
  },
  {
    attribute: 'custom_label_0',
    gmcAttribute: 'custom_label_0',
    isVariation: true,
    formatter: (feedSpecification) => {
      return [
        {
          text: feedSpecification, value: feedSpecification
        }
      ]
    }
  },
  {
    attribute: 'custom_label_1',
    gmcAttribute: 'custom_label_1',
    isVariation: true,
    formatter: (feedSpecification) => {
      return [
        {
          text: feedSpecification, value: feedSpecification
        }
      ]
    }
  },
  {
    attribute: 'custom_label_2',
    gmcAttribute: 'custom_label_2',
    isVariation: true,
    formatter: (feedSpecification) => {
      return [
        {
          text: feedSpecification, value: feedSpecification
        }
      ]
    }
  },
  {
    attribute: 'custom_label_3',
    gmcAttribute: 'custom_label_3',
    isVariation: true,
    formatter: (feedSpecification) => {
      return [
        {
          text: feedSpecification, value: feedSpecification
        }
      ]
    }
  },
  {
    attribute: 'custom_label_4',
    gmcAttribute: 'custom_label_4',
    isVariation: true,
    formatter: (feedSpecification) => {
      return [
        {
          text: feedSpecification, value: feedSpecification
        }
      ]
    }
  }
]
