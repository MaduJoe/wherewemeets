import React, { useEffect, useState } from 'react';
import { Canvas } from '@react-three/fiber';
import { useBox, Physics, usePlane } from '@react-three/cannon';
import { OrbitControls, Text } from '@react-three/drei';
import * as THREE from 'three';

// 주사위 면 컴포넌트
const DiceFace = ({ position, rotation, number }) => {
  return (
    <group position={position} rotation={rotation}>
      <Text
        fontSize={0.3}
        color="black"
        anchorX="center"
        anchorY="middle"
        position={[0, 0, 0.01]}
      >
        {number}
      </Text>
    </group>
  );
};

// 3D 주사위 컴포넌트
const Dice = ({ position, onResult, shouldRoll, resetRoll }) => {
  const [ref, api] = useBox(() => ({
    mass: 1,
    position: position,
    args: [1, 1, 1],
    friction: 0.4,
    restitution: 0.3,
  }));

  const [isRolling, setIsRolling] = useState(false);
  const [hasResult, setHasResult] = useState(false);

  // 주사위 굴리기
  useEffect(() => {
    if (shouldRoll && !isRolling) {
      setIsRolling(true);
      setHasResult(false);
      
      // 랜덤한 방향으로 충격 가하기
      const force = 15;
      const randomX = (Math.random() - 0.5) * force;
      const randomZ = (Math.random() - 0.5) * force;
      const upwardForce = force * 0.8;
      
      // 랜덤한 회전 토크 추가
      const torqueX = (Math.random() - 0.5) * 20;
      const torqueY = (Math.random() - 0.5) * 20;
      const torqueZ = (Math.random() - 0.5) * 20;
      
      api.applyImpulse([randomX, upwardForce, randomZ], [0, 0, 0]);
      api.applyTorque([torqueX, torqueY, torqueZ]);
      
      resetRoll();
    }
  }, [shouldRoll, isRolling, api, resetRoll]);

  // 주사위가 멈췄을 때 결과 계산
  useEffect(() => {
    const unsubscribe = api.velocity.subscribe((velocity) => {
      const speed = Math.sqrt(velocity[0] ** 2 + velocity[1] ** 2 + velocity[2] ** 2);
      
      if (speed < 0.1 && isRolling && !hasResult) {
        setIsRolling(false);
        setHasResult(true);
        
        // 주사위 면 결정
        setTimeout(() => {
          if (ref.current) {
            const quaternion = new THREE.Quaternion();
            ref.current.getWorldQuaternion(quaternion);
            
            // 각 면의 법선 벡터
            const faceNormals = [
              new THREE.Vector3(0, 1, 0),  // 윗면 (1)
              new THREE.Vector3(0, -1, 0), // 아랫면 (6)
              new THREE.Vector3(1, 0, 0),  // 오른쪽 면 (2)
              new THREE.Vector3(-1, 0, 0), // 왼쪽 면 (5)
              new THREE.Vector3(0, 0, 1),  // 앞면 (3)
              new THREE.Vector3(0, 0, -1), // 뒷면 (4)
            ];
            
            const diceNumbers = [1, 6, 2, 5, 3, 4];
            
            let maxY = -Infinity;
            let topFaceIndex = 0;
            
            faceNormals.forEach((normal, index) => {
              const rotatedNormal = normal.clone().applyQuaternion(quaternion);
              if (rotatedNormal.y > maxY) {
                maxY = rotatedNormal.y;
                topFaceIndex = index;
              }
            });
            
            const result = diceNumbers[topFaceIndex];
            onResult(result);
          }
        }, 500);
      }
    });
    
    return unsubscribe;
  }, [api, isRolling, hasResult, onResult, ref]);

  return (
    <group>
      <mesh ref={ref} castShadow>
        <boxGeometry args={[1, 1, 1]} />
        <meshStandardMaterial color="white" />
        
        {/* 주사위 면 숫자들 */}
        <DiceFace position={[0, 0.51, 0]} rotation={[-Math.PI/2, 0, 0]} number="1" />
        <DiceFace position={[0, -0.51, 0]} rotation={[Math.PI/2, 0, 0]} number="6" />
        <DiceFace position={[0.51, 0, 0]} rotation={[0, Math.PI/2, 0]} number="2" />
        <DiceFace position={[-0.51, 0, 0]} rotation={[0, -Math.PI/2, 0]} number="5" />
        <DiceFace position={[0, 0, 0.51]} rotation={[0, 0, 0]} number="3" />
        <DiceFace position={[0, 0, -0.51]} rotation={[0, Math.PI, 0]} number="4" />
      </mesh>
    </group>
  );
};

// 바닥 컴포넌트
const Ground = () => {
  const [ref] = usePlane(() => ({
    rotation: [-Math.PI / 2, 0, 0],
    position: [0, -3, 0],
  }));

  return (
    <mesh ref={ref} receiveShadow>
      <planeGeometry args={[20, 20]} />
      <meshStandardMaterial color="#4ade80" />
    </mesh>
  );
};

// 벽 컴포넌트
const Wall = ({ position, rotation }) => {
  const [ref] = useBox(() => ({
    position,
    rotation,
    args: [0.1, 5, 10],
    type: 'Static',
  }));

  return (
    <mesh ref={ref}>
      <boxGeometry args={[0.1, 5, 10]} />
      <meshStandardMaterial transparent opacity={0.1} color="blue" />
    </mesh>
  );
};

// 메인 3D 주사위 컴포넌트
const Dice3D = ({ onResult, shouldRoll, resetRoll, onDiceClick, isClickable, hasResult }) => {
  const handleCanvasClick = () => {
    if (isClickable && onDiceClick) {
      onDiceClick();
    }
  };

  return (
    <div style={{ width: '100%', height: '400px', position: 'relative' }}>
      {isClickable && (
        <div 
          style={{
            position: 'absolute',
            top: '10px',
            left: '50%',
            transform: 'translateX(-50%)',
            backgroundColor: 'rgba(59, 130, 246, 0.9)',
            color: 'white',
            padding: '4px 12px',
            borderRadius: '20px',
            fontSize: '12px',
            fontWeight: 'bold',
            zIndex: 10,
            pointerEvents: 'none'
          }}
        >
          {hasResult ? '클릭하여 다시 하기' : '클릭하여 주사위 굴리기'}
        </div>
      )}
      <Canvas
        camera={{ position: [8, 8, 8], fov: 50 }}
        shadows
        onClick={handleCanvasClick}
        style={{ 
          cursor: isClickable ? 'pointer' : 'default',
          border: isClickable ? '2px solid #3b82f6' : '2px solid #d1d5db',
          borderRadius: '8px',
          transition: 'all 0.3s ease',
          backgroundColor: isClickable ? '#f8fafc' : '#f1f5f9'
        }}
        onPointerEnter={(e) => {
          if (isClickable) {
            e.target.style.borderColor = '#1d4ed8';
            e.target.style.backgroundColor = '#eff6ff';
          }
        }}
        onPointerLeave={(e) => {
          if (isClickable) {
            e.target.style.borderColor = '#3b82f6';
            e.target.style.backgroundColor = '#f8fafc';
          }
        }}
      >
        <ambientLight intensity={0.6} />
        <directionalLight 
          position={[10, 10, 5]} 
          intensity={1} 
          castShadow
          shadow-mapSize-width={2048}
          shadow-mapSize-height={2048}
        />
        
        <Physics gravity={[0, -30, 0]} defaultContactMaterial={{ restitution: 0.4 }}>
          <Ground />
          
          {/* 벽들 */}
          <Wall position={[5, 0, 0]} rotation={[0, 0, 0]} />
          <Wall position={[-5, 0, 0]} rotation={[0, 0, 0]} />
          <Wall position={[0, 0, 5]} rotation={[0, Math.PI/2, 0]} />
          <Wall position={[0, 0, -5]} rotation={[0, Math.PI/2, 0]} />
          
          <Dice 
            position={[0, 5, 0]} 
            onResult={onResult}
            shouldRoll={shouldRoll}
            resetRoll={resetRoll}
          />
        </Physics>
        
        <OrbitControls 
          enablePan={false}
          enableZoom={true}
          enableRotate={true}
          maxDistance={15}
          minDistance={5}
        />
      </Canvas>
    </div>
  );
};

export default Dice3D; 