import { map, filter } from 'lodash'

export function getIntersectionName(lines, lineIds) {
  let names = map(lineIds, (id) => lines[id].name)

  let numberNames = filter(names, (name) => !!name.match(/[0-9]+/))
  let letterNames = filter(names, (name) => !!name.match(/[A-Za-z]+/))

  return [
    ...letterNames,
    ...numberNames
  ].join('')
}
