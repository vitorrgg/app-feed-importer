module.exports = [
  {
    attribute: 'energy_efficiency_class'
  },
  {
    attribute: 'age_group'
  },
  {
    attribute: 'gender'
  },
  {
    attribute: 'material'
  },
  {
    attribute: 'pattern'
  },
  {
    attribute: 'size'
  },
  {
    attribute: 'size_type'
  },
  {
    attribute: 'size_system'
  },
  {
    attribute: 'colors',
    formatter: (value) => {
      // need formatter color
      return value
    }
  }
]
