import React, { Fragment, useEffect, useRef } from 'react'
import { useSelector, useDispatch } from 'react-redux'
import { Stage, Layer, Image, Line, Rect } from 'react-konva'
import useImage from 'use-image'
import cuid from 'cuid'
import { each, map, flatten, maxBy, values } from 'lodash'
import { intersect } from 'mathjs'
import { FlexContainer, LeftColumn, RightColumn } from '../layout'
import { getIntersectionName } from '../utilities'

export default function DrawGrid() {
  const state = useSelector(s => s.cropper)
  const dispatch = useDispatch()
  const [konvaImage] = useImage(state.image.base64)
  const stageContainer = useRef()

  useEffect(() => {
    function handleKeyPress(e) {
      if (e.code === 'Escape') {
        if (state.drawingLineId) {
          dispatch({
            type: 'cropper/removeLine',
            payload: state.drawingLineId
          })

          dispatch({type: 'cropper/stopDrawing'})
        }

        if (state.sidebarLineId) {
          dispatch({type: 'cropper/closeSidebar'})
        }

        dispatch({type: 'cropper/setClickToDrawLine', payload: false})
      }

      if (e.code === 'KeyN') {
        dispatch({
          type: 'cropper/setClickToDrawLine',
          payload: true
        })
      }
    }

    document.addEventListener('keydown', handleKeyPress)
    return () => { document.removeEventListener('keydown', handleKeyPress) }
  }, [dispatch, state.drawingLineId, state.sidebarLineId])

  useEffect(() => {
    function calculateScale() {
      if (!stageContainer.current) return;
      let scales = [1]
      let availableHeight = window.innerHeight - stageContainer.current.offsetTop
      let availableWidth = window.innerWidth - stageContainer.current.offsetLeft

      if (state.image.width > availableWidth) {
        scales.push(availableWidth / state.image.width)
      }

      if (state.image.height > availableHeight) {
        scales.push(availableHeight / state.image.height)
      }

      dispatch({type: 'cropper/setScale', payload: Math.min(...scales)})
    }
    calculateScale()

    window.addEventListener('resize', calculateScale)
    return () => { window.removeEventListener('resize', calculateScale) }
  }, [dispatch, state.image.width, state.image.height])

  function handleLineClick(line) {
    dispatch({
      type: 'cropper/editLineInSidebar',
      meta: { lineId: line.id }
    })
  }

  function calculateIntersections() {
    const allLines = values(state.lines).slice()
    const intersections = []

    while(allLines.length) {
      let checkingLine = allLines.pop();

      each(allLines, (otherLine) => {
        let res = intersect(
          [
            checkingLine.points[0][0],
            checkingLine.points[0][1]
          ],
          [
            checkingLine.points[1][0],
            checkingLine.points[1][1]
          ],
          [
            otherLine.points[0][0],
            otherLine.points[0][1]
          ],
          [
            otherLine.points[1][0],
            otherLine.points[1][1]
          ]
        )

        if (
          res &&
          res[0] < state.image.width &&
          res[1] < state.image.height &&
          res[0] > 0 &&
          res[1] > 0
        ) {
          intersections.push({
            location: [Math.round(res[0]), Math.round(res[1])],
            lineIds: [checkingLine.id, otherLine.id]
          })
        }
      })
    }

    dispatch({
      type: 'cropper/setIntersections',
      payload: intersections
    })
  }

  function removeLast() {
    let removeLine = maxBy(values(state.lines), 'added')
    let removeId = removeLine && removeLine.id
    if (removeId) dispatch({type: 'cropper/removeLine', payload: removeId});
  }

  function createLine(startX, startY) {
    let lineId = cuid()

    dispatch({
      type: 'cropper/createLine',
      meta: { lineId },
      payload: {
        id: lineId,
        points: [[Math.round(startX / state.scale), Math.round(startY / state.scale)]],
        added: Date.now(),
        name: ''
      }
    })

    dispatch({
      type: 'cropper/startDrawing',
      meta: { lineId }
    })
  }

  function handleMouseMove(e) {
    if (state.drawingLineId) {
      dispatch({
        type: 'cropper/setLineFinish',
        meta: { lineId: state.drawingLineId },
        payload: [
          Math.round(e.evt.offsetX / state.scale),
          Math.round(e.evt.offsetY / state.scale)
        ]
      })
    }
  }

  function handleClick(e) {
    if (state.drawingLineId) {
      finishLine(state.drawingLineId)
      dispatch({type: 'cropper/stopDrawing'})
    } else if (state.clickToDrawLine) {
      createLine(e.evt.offsetX, e.evt.offsetY)
      dispatch({type: 'cropper/setClickToDrawLine', payload: false})
    }
  }

  function finishLine(lineId) {
    let start = state.lines[lineId].points[0]
    let finish = state.lines[lineId].points[1]
    let len = Math.sqrt(Math.pow(start[0] - finish[0], 2) + Math.pow(start[1] - finish[1], 2))

    let addAmt = 0
    let stopAdding = false
    let newFinish

    while (!stopAdding) {
      addAmt++;

      newFinish = [
        Math.round(finish[0] + (finish[0] - start[0]) / len * addAmt),
        Math.round(finish[1] + (finish[1] - start[1]) / len * addAmt)
      ]

      if (newFinish[0] > state.image.width || newFinish[1] > state.image.height || newFinish[0] < 0 || newFinish[1] < 0) {
        stopAdding = true
      }
    }

    let removeAmt = 0
    let stopRemoving = false
    let newStart

    while (!stopRemoving) {
      removeAmt = removeAmt - 1

      newStart = [
        Math.round(finish[0] + (finish[0] - start[0]) / len * removeAmt),
        Math.round(finish[1] + (finish[1] - start[1]) / len * removeAmt)
      ]

      if (newStart[0] > state.image.width || newStart[1] > state.image.height || newStart[0] < 0 || newStart[1] < 0) {
        stopRemoving = true
      }
    }

    dispatch({
      type: 'cropper/replaceLinePoints',
      meta: { lineId },
      payload: [newStart, newFinish]
    })

    dispatch({
      type: 'cropper/editLineInSidebar',
      meta: { lineId }
    })
  }

  function doneDrawing() {
    // do something with the intersections...
    dispatch({
      type: 'cropper/setStep',
      payload: 'imageReview'
    })
  }

  return (
    <FlexContainer>
      <LeftColumn sticky={true}>
        <div>
          {
            state.clickToDrawLine ?
              <button disabled>Click image to draw new line</button> :
              <button onClick={() => dispatch({type: 'cropper/setClickToDrawLine', payload: true})}><u>N</u>ew line</button>
          }

          <button onClick={removeLast}>removeLast</button>
          <button onClick={calculateIntersections}>calculateIntersections</button>
          <button
            onClick={doneDrawing}
            disabled={state.intersections.length === 0}
          >doneDrawing</button>
        </div>

        {
          state.drawingLineId ?
            'Drawing...' :
            (
              state.sidebarLineId && state.lines[state.sidebarLineId] ?
                <SidebarLine /> :
                <SidebarAllLines />
            )
        }
      </LeftColumn>
      <RightColumn>
        <div ref={stageContainer}>
          <Stage
            width={window.innerWidth}
            height={window.innerHeight}
            scale={{x: state.scale, y: state.scale}}
            onContentMouseMove={handleMouseMove}
            onContentClick={handleClick}
          >
            <Layer>
              <Image
                image={konvaImage}
              />
            </Layer>

            <Layer>
              {map(state.lines, (line, id) => {
                if (line.points.length === 0) return null;

                return (
                  <Line
                    key={id}
                    points={flatten(line.points)}
                    stroke={id === state.sidebarLineId ? 'blue' : 'red'}
                    strokeWidth={3 / state.scale}
                    onClick={() => handleLineClick(line)}
                  />
                )
              })}

              {map(state.intersections, ({location}) => {
                return (
                  <Rect
                    x={location[0]}
                    y={location[1]}
                    key={`${location[0]},${location[1]}`}
                    width={5 / state.scale}
                    height={5 / state.scale}
                    fill='blue'
                  />
                )
              })}
            </Layer>
          </Stage>
        </div>
      </RightColumn>
    </FlexContainer>
  )
}

function SidebarLine() {
  const state = useSelector(s => s.cropper)
  const dispatch = useDispatch()
  const line = state.lines[state.sidebarLineId]
  const nameInput = useRef()

  useEffect(() => {
    nameInput.current && nameInput.current.focus()
  }, [nameInput])

  function save() {
    dispatch({type: 'cropper/closeSidebar'})
  }

  return (
    <Fragment>
      <span onClick={() => {dispatch({type: 'cropper/closeSidebar'})}} className='link'>Back</span>
      <h4>Name this line...</h4>

      <form onSubmit={(e) => { e.preventDefault(); save();} }>
        <input
          type='text'
          ref={nameInput}
          value={line.name || ''}
          onChange={(e) => dispatch({type: 'cropper/setLineName', meta: { lineId: line.id }, payload: e.target.value})}
        />

        <button type='submit'>Save</button>
      </form>
    </Fragment>
  )
}

function SidebarAllLines() {
  const state = useSelector(s => s.cropper)
  const dispatch = useDispatch()

  function editLine(id) {
    dispatch({
      type: 'cropper/editLineInSidebar',
      meta: { lineId: id }
    })
  }

  return (
    <Fragment>
      <h4>Lines</h4>
      <ul>
        {map(state.lines, (line, id) => {
          return <li key={id}><span className='link' onClick={() => editLine(id)}>{line.name || 'Unnamed line'}</span></li>
        })}
      </ul>

      <h4>Intersections</h4>
      <ul>
        {map(state.intersections, (i) => {
          return <li key={i.location}>[{i.location[0]}, {i.location[1]}]: {getIntersectionName(state.lines, i.lineIds)}</li>
        })}
      </ul>
    </Fragment>
  )
}
