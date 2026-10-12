import React from 'react';
import { useQuery } from '@tanstack/react-query';
import { studentAPI } from '../../api';
import Loading from '../common/Loading';
import { useNavigate } from 'react-router-dom';

const TestList = ({ showSchedule = false }) => {
  const navigate = useNavigate();

  // ✅ useQuery v5 syntax
  const { data: testsData, isLoading: testsLoading } = useQuery({
    queryKey: showSchedule ? ['studentTestSchedule'] : ['studentTests'],
    queryFn: showSchedule ? studentAPI.getTestSchedule : studentAPI.getAvailableTests
  });

  if (testsLoading) return <Loading message="Loading tests..." />;

  const tests = testsData?.data || [];

  return (
    <>
      {/* Mobile-First Responsive Styles */}
      <style>{`
        .test-list-container {
          padding: 1rem;
          max-width: 100%;
          overflow-x: hidden;
        }
        .test-list-grid {
          display: grid;
          grid-template-columns: 1fr; /* Stack on mobile */
          gap: 1rem;
          margin-top: 1.5rem;
        }
        @media (min-width: 640px) {
          .test-list-grid {
            grid-template-columns: repeat(2, 1fr); /* 2 columns on tablet */
          }
        }
        @media (min-width: 1024px) {
          .test-list-grid {
            grid-template-columns: repeat(3, 1fr); /* 3 columns on desktop */
          }
        }
        .test-list-card {
          display: flex;
          flex-direction: column;
          height: 100%;
          overflow: hidden;
          border-radius: 8px;
          box-shadow: 0 4px 6px -1px rgba(0, 0, 0, 0.1);
        }
        .test-list-card .card-header {
          display: flex;
          justify-content: space-between;
          align-items: center;
          gap: 0.5rem;
          padding: 1rem;
          flex-wrap: wrap; /* Allows badge to drop below title on very small screens */
        }
        .test-list-card .card-header h3 {
          font-size: 1.1rem;
          margin: 0;
          word-break: break-word; /* Prevents long titles from breaking layout */
        }
        .test-list-card .card-body {
          padding: 1rem;
          flex: 1; /* Pushes footer to the bottom */
        }
        .test-list-card .card-footer {
          padding: 1rem;
        }
        .test-list-card .card-footer .btn {
          width: 100%; /* Full width buttons on mobile */
        }
        .page-title { font-size: 1.5rem; }
        .page-subtitle { font-size: 0.875rem; }
        @media (min-width: 768px) {
          .page-title { font-size: 2rem; }
          .page-subtitle { font-size: 1rem; }
        }
      `}</style>

      <div className="test-list-container">
        <h1 className="page-title">{showSchedule ? 'Test Schedule' : 'Available Tests'}</h1>
        <p className="page-subtitle">
          {showSchedule
            ? 'View all tests including upcoming and completed'
            : 'Tests currently available for you to take'}
        </p>

        {tests.length === 0 ? (
          <div className="empty-state">
            <div className="empty-state-icon">📝</div>
            <div className="empty-state-title">
              {showSchedule ? 'No Tests Found' : 'No Available Tests'}
            </div>
            <div className="empty-state-text">
              {showSchedule
                ? 'There are no tests scheduled for your class'
                : 'There are no tests currently available. Check back later.'}
            </div>
          </div>
        ) : (
          <div className="test-list-grid">
            {tests.map((test) => (
              <div key={test._id} className="card test-list-card">
                <div
                  className="card-header"
                  style={{
                    background: test.status === 'active' ? 'var(--success-dark)' : test.status === 'upcoming' ? 'var(--info-color)' : 'var(--gray-600)',
                    color: 'white',
                  }}
                >
                  <h3>{test.title}</h3>
                  <span 
                    className={`badge ${test.status === 'active' ? 'badge-success' : test.status === 'upcoming' ? 'badge-info' : 'badge-secondary'}`}
                    style={{ background: 'rgba(255,255,255,0.2)', color: 'white' }}
                  >
                    {test.statusText || test.status}
                  </span>
                </div>
                
                <div className="card-body">
                  <div style={{ marginBottom: '0.5rem', fontSize: '0.9rem' }}>
                    <strong>Subject:</strong> {test.subjectId?.name}
                  </div>
                  <div style={{ marginBottom: '0.5rem', fontSize: '0.9rem' }}>
                    <strong>Duration:</strong> {test.duration} minutes
                  </div>
                  <div style={{ marginBottom: '0.5rem', fontSize: '0.9rem' }}>
                    <strong>Questions:</strong> {test.questions?.length || 'N/A'}
                  </div>
                  <div style={{ marginBottom: '0.5rem', fontSize: '0.9rem' }}>
                    <strong>Pass Mark:</strong> {test.passMark}%
                  </div>
                  
                  {showSchedule && (
                    <>
                      <div style={{ marginBottom: '0.5rem', fontSize: '0.9rem' }}>
                        <strong>Start:</strong> {new Date(test.startDate).toLocaleString()}
                      </div>
                      <div style={{ marginBottom: '0.5rem', fontSize: '0.9rem' }}>
                        <strong>End:</strong> {new Date(test.endDate).toLocaleString()}
                      </div>
                      <div style={{ marginBottom: '0.5rem', fontSize: '0.9rem' }}>
                        <strong>Time:</strong> {test.timeRemaining}
                      </div>
                    </>
                  )}
                  
                  {test.hasTakenTest && (
                    <div style={{ marginTop: '0.5rem' }}>
                      <span className="badge badge-warning">Already Taken</span>
                    </div>
                  )}
                </div>
                
                <div className="card-footer">
                  {test.canTake ? (
                    <button
                      className="btn btn-success btn-block"
                      onClick={() => navigate(`/student/tests/${test._id}`)}
                    >
                      Start Test
                    </button>
                  ) : test.hasTakenTest ? (
                    <button className="btn btn-secondary btn-block" disabled>
                      Test Completed
                    </button>
                  ) : (
                    <button className="btn btn-secondary btn-block" disabled>
                      {test.status === 'upcoming' ? 'Not Yet Available' : 'Test Ended'}
                    </button>
                  )}
                </div>
              </div>
            ))}
          </div>
        )}
      </div>
    </>
  );
};

export default TestList;