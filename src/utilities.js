import { map, filter } from 'lodash'

export function getIntersectionName(lines, rects, intersection) {
  if (intersection.rectId) {
    return `rect-${rects[intersection.rectId].name}`
  }

  let names = map(intersection.lineIds, (id) => lines[id].name)

  let numberNames = filter(names, (name) => !!name.match(/^[0-9]+$/))
  let letterNames = filter(names, (name) => !!name.match(/^[A-Za-z]+$/))

  if (numberNames.length && letterNames.length) {
    return [
      ...letterNames,
      ...numberNames
    ].join('')
  } else {
    return names.join(',')
  }

}

export function nextNameInSequence(type, allNames) {
  if (type === 'alphabetical') {
    let allAlphabeticalNames = filter(allNames, (name) => name.match(/^[A-Z]$/)).sort().reverse()

    if (allAlphabeticalNames.length) {
      return String.fromCharCode(allAlphabeticalNames[0].charCodeAt(0) + 1)
    } else {
      return 'A'
    }
  } else if (type === 'numeric') {
    let allNumericNames = map(
      filter(allNames, (name) => name.match(/^[0-9]+$/)),
      (name) => parseInt(name, 10)
    )

    if (allNumericNames.length) {
      return (Math.max(...allNumericNames) + 1).toString()
    } else {
      return '1'
    }
  } else {
    throw new Error('type not recognized')
  }
}

export function sortAlphabetically(arr, iteratee) {
  let collator = new Intl.Collator(
    undefined, {
      numeric: true,
      sensitivity: 'base'
    }
  )

  return arr.sort((a, b) => {
    return collator.compare(
      typeof iteratee === 'string' ? a[iteratee] : iteratee(a),
      typeof iteratee === 'string' ? b[iteratee] : iteratee(b)
    )
  })
}
