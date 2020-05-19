import React, { useEffect, useCallback } from 'react'
import { useSelector, useDispatch } from 'react-redux'
import { Stage, Layer, Image, Rect } from 'react-konva'
import Konva from 'konva'
import useImage from 'use-image'
import { filter, each } from 'lodash'
import { FlexContainer, LeftColumn, RightColumn } from '../layout'
import JSZip from 'jszip'
import { saveAs } from 'file-saver'
import { DEFAULT_HOLD_IMAGE_SIZE } from '../constants'
import { getIntersectionName } from '../utilities'

export default function ImageReview() {
  let state = useSelector(s => s.cropper)
  let dispatch = useDispatch()
  let imageReviewState = useSelector(s => s.cropper.imageReview)
  const [konvaImage] = useImage(state.image.base64)
  const activeIntersection = state.intersections[imageReviewState.reviewingIdx]
  const previousIntersection = state.intersections[imageReviewState.reviewingIdx - 1]
  const stageSize = 400
  const imageSize = (
    activeIntersection.size ||
    (previousIntersection && previousIntersection.size) ||
    DEFAULT_HOLD_IMAGE_SIZE
  )

  const hold = useCallback(() => {
    dispatch({type: 'cropper/reviewChangeSize', payload: imageSize})

    dispatch({
      type: 'cropper/reviewImage',
      payload: true
    })

    dispatch({type: 'cropper/reviewNext'})
  }, [dispatch, imageSize])

  const notHold = useCallback(() => {
    dispatch({type: 'cropper/reviewChangeSize', payload: imageSize})

    dispatch({
      type: 'cropper/reviewImage',
      payload: false
    })

    dispatch({type: 'cropper/reviewNext'})
  }, [dispatch, imageSize])

  useEffect(() => {
    const handleKeyPress = (e) => {
      if (e.code === 'KeyH') {
        hold()
      }

      if (e.code === 'KeyN') {
        notHold()
      }
    }

    document.addEventListener('keydown', handleKeyPress)
    return () => { document.removeEventListener('keydown', handleKeyPress) }
  }, [hold, notHold])

  function previousStep() {
    dispatch({
      type: 'cropper/setStep',
      payload: 'drawGrid'
    })
  }

  function finish() {
    let holdIntersections = filter(state.intersections, (i) => i.review)
    let imageFiles = []

    each(holdIntersections, (i) => {
      let exportStageSize = i.size || DEFAULT_HOLD_IMAGE_SIZE
      let stage = new Konva.Stage({
        container: 'hiddenStageContainer',
        width: exportStageSize,
        height: exportStageSize
      });

      let layer = new Konva.Layer()

      let image = new Konva.Image({
        image: konvaImage,
        x: 0,
        y: 0,
        offsetX: i.location[0] - (exportStageSize / 2),
        offsetY: i.location[1] - (exportStageSize / 2)
      })

      layer.add(image)
      stage.add(layer)

      imageFiles.push({
        name: getIntersectionName(state.lines, i.lineIds),
        data: stage.toDataURL()
      })
    })

    let zip = new JSZip()
    let folder = zip.folder('cropper-export');
    each(imageFiles, ({name, data}) => {
      folder.file(`${name}.png`, data.split('base64,')[1], {base64: true})
    })
    zip.generateAsync({type:"blob"}).then(function(content) {
      saveAs(content, "cropper-export.zip");
    })
  }

  return (
    <FlexContainer>
      <LeftColumn sticky={true}>
        <div>
          <span className='link' onClick={() => dispatch({type: 'cropper/reviewPrevious'})}>Prev</span>
          &nbsp;
          <span className='link' onClick={() => dispatch({type: 'cropper/reviewNext'})}>Next</span>
        </div>

        Reviewing {imageReviewState.reviewingIdx + 1} of {state.intersections.length}

        <div>
          <button onClick={hold}><u>H</u>old</button>
          <button onClick={notHold}><u>N</u>ot hold</button>

          <div>
            <label>Size</label>
            <input
              type='range'
              min={0}
              max={1000}
              value={imageSize}
              onChange={(e) => dispatch({type: 'cropper/reviewChangeSize', payload: e.target.value})}
            />
          </div>
        </div>

        <div>
          <div>Location: [{activeIntersection.location.join(',')}]</div>
          <div>Name: {getIntersectionName(state.lines, activeIntersection.lineIds)}</div>
          <div>Set as: {activeIntersection.review ? 'Hold' : 'Not hold'}</div>
          <div>Size: {imageSize}</div>
        </div>

        <div className='pt4'>
          <button onClick={previousStep}>Back</button>
          <button onClick={finish}>Finish</button>
        </div>
      </LeftColumn>
      <RightColumn>
        <div id='hiddenStageContainer' style={{display: 'none'}} />

        <Stage
          width={stageSize}
          height={stageSize}
        >
          <Layer>
            <Image
              image={konvaImage}
              offsetX={activeIntersection.location[0] - (stageSize / 2)}
              offsetY={activeIntersection.location[1] - (stageSize / 2)}
            />

            <Rect
              x={stageSize / 2}
              y={stageSize / 2}
              offsetX={imageSize / 2}
              offsetY={imageSize / 2}
              width={imageSize}
              height={imageSize}
              fill='red'
              opacity={0.2}
            />

            <Rect
              x={stageSize / 2}
              y={stageSize / 2}
              offsetX={3}
              offsetY={3}
              width={6}
              height={6}
              fill='blue'
            />
          </Layer>
        </Stage>
      </RightColumn>
    </FlexContainer>
  )
}
